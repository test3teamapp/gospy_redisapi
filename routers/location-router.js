import { Router } from 'express'
import { personRepository } from '../om/person.js'
import { default as redisClient } from '../om/redisDB_client.js'
import { meetingsGraph } from '../om/redisGraph_client.js'
import { Client as googleMapsClient } from "@googlemaps/google-maps-services-js";

export const router = Router()

const gmaps = new googleMapsClient({});

async function updateGraph(meetingMembers, meetingDate) {

  let meetingNames = [];
  let meetingLocation = { lat: 0.0, lng: 0.0 };
  let meetingAddress = '';
  let meetingGMapsPlaceId = '';

  // http://www.geomidpoint.com/calculation.html
  // find Average latitude/longitude
  /*
  This method finds a simple average latitude and longitude for the locations
  This is equivalent to finding a midpoint on a flat rectangular projection map. 
  When the distance between locations is less than 250 miles (400 km), 
  this method gives a close approximation to the true geographic midpoint 
  */
  meetingMembers.forEach(async person => {
    meetingLocation.lat = meetingLocation.lat + person.location.latitude
    meetingLocation.lng = meetingLocation.lng + person.location.longitude
    meetingNames.push(person.name)
  });
  meetingLocation.lat = parseFloat((meetingLocation.lat / meetingMembers.length).toFixed(3));
  meetingLocation.lng = parseFloat((meetingLocation.lng / meetingMembers.length).toFixed(3));

  console.log("average lat for meeting :" + meetingLocation.lat);
  console.log("average lng for meeting :" + meetingLocation.lng);
  // call google maps to get a place_id for the location

  const geoparams = {
    latlng: {
      lat: meetingLocation.lat,
      lng: meetingLocation.lng
    },
    key: process.env.GOOGLE_MAPS_API_KEY
  };
  const r = await gmaps.reverseGeocode({ params: geoparams });
  //console.log(" checking with google for address, return :" + JSON.stringify(r.data));
  if (r.data.status === 'OK') {
    meetingAddress = r.data.results[0].formatted_address;
    meetingGMapsPlaceId = r.data.results[0].place_id;

    //const jsonStr = JSON.stringify(r.data.results[0]);
    console.log(r.data.results[0].formatted_address);
    console.log(r.data.results[0].place_id);
  }

  let graphResult;

  meetingNames.forEach(async element => {
    console.log(` name in meetings names : ${element} `)
    graphResult = await meetingsGraph.query(
      'MATCH (p:Person { name: $name }) RETURN p.name AS name',
      {
        params: {
          name: element.toString()
        }
      }
    );

    if (graphResult.data.length == 0) {
      console.log(` name was not in the graph : ${element} `)

      await meetingsGraph.query(
        'CREATE (:Person { name: $name })',
        {
          params: {
            name: element.toString()
          }
        }
      );

      console.log(` name was added to the graph : ${element} `)
    }
  });

  // check for existing places in GEO key in Redis

  let resultGEO = await redisClient.GEOSEARCH("MeetingPlaces", {from:"FROMLONLAT", longitude: meetingLocation.lng, latitude: meetingLocation.lat},{by:"BYRADIUS", radius:300, unit:"m"}, "ASC", "WITHCOORD", "WITHDIST");
  console.log("current meetings found in area  " + JSON.stringify(resultGEO));
  if (resultGEO.length == 0) {
    resultGEO = await redisClient.GEOADD("MeetingPlaces", {longitude: meetingLocation.lng, latitude: meetingLocation.lat, member: meetingAddress});
  } else {
    console.log("Aggregate meeting @ " + JSON.stringify(resultGEO[0]));
    // use the address of an existing meeting place in the area
    meetingAddress = resultGEO[0];
  }
  // check for existing places in Graph

  console.log(` check whether the place exists : ${meetingAddress} `)
  graphResult = await meetingsGraph.roQuery(
    'MATCH (p:Place {name : $name }) RETURN p.name AS name',
    {
      params: {
        name: meetingAddress
      }
    }
  );

  if (graphResult.data.length == 0) {
    console.log(` place was not in the graph : ${meetingAddress} `)

    await meetingsGraph.query(
      'CREATE (:Place { name: $name, gmaps_place_id: $place_id, lng: $lng, lat: $lat })',
      {
        params: {
          name: meetingAddress,
          place_id: meetingGMapsPlaceId,
          lng: meetingLocation.lng,
          lat: meetingLocation.lat
        }
      }
    );

    console.log(` place was added to the graph : ${meetingAddress} `)
  }


  // check if there are any other meetings taking place in the area already
  let timestampNow = Date.now();
  const timestamp1HourAgo = timestampNow - (60 * 60000); // past hour

  graphResult = await meetingsGraph.roQuery(
    'MATCH (m:Meeting) , (p:Place {name: $name}) \
  WHERE (m)-[:AT_PLACE]->(p) \
  AND m.date < $tnow AND m.date > $tPastHour RETURN m ORDER BY m.date DESC',
    {
      params: {
        name: meetingAddress,
        tnow: timestampNow,
        tPastHour: timestamp1HourAgo
      }
    }
  );

  console.log(` searching for existing meeting. result =  ${JSON.stringify(graphResult)}`)
 
  if (graphResult.data.length == 0){
    // IF NOT create a meeting
    await meetingsGraph.query(
      'MATCH (p:Place {name: $name}) \
      CREATE (:Meeting { date: $date, stringDate: $strDate})-[:AT_PLACE]->(p)',
      {
        params: {
          name: meetingAddress,
          date: timestampNow,
          strDate: meetingDate.toString()
        }
      }
    );
    console.log(` created meeting `)
  }else {
    // move date of meeting to current date, leave string date to original (first time we created the meeting )
    // more people showing up within the hour, we extend the presence of the meeting.
    // get the first one returned (most recent)
    timestampNow = Number.parseInt(graphResult.data[0].m.properties.date);
    console.log(` joining meeting that started @ ${graphResult.data[0].m.properties.stringDate}`)
  }
  

 
  // set people as taking part in the meeting
  await meetingsGraph.query(
    'UNWIND $arrayOfNames as person_name \
    MATCH (m:Meeting { date: $date}), (p:Place {name:  $name}) \
    WHERE (m)-[:AT_PLACE]->(p) \
    MERGE (:Person {name: person_name})-[:PART_OF]->(m)',
    {
      params: {
        arrayOfNames: meetingNames,
        date: timestampNow,
        name: meetingAddress
      }
    }
  );

}

router.patch('/byID/:id/location/:lat,:lng', async (req, res) => {

  const id = req.params.id
  //console.log(`req.params.lng : ${req.params.lng} , req.params.lat : ${req.params.lat}`)
  const lng = Number(req.params.lng)
  const lat = Number(req.params.lat)

  const locationUpdatedDate = new Date()

  const person = await personRepository.fetch(id)

  if (person.name == null) {
    res.send({ "ERROR": `NO PERSON FOUND BY ID: ${id}` })
  } else {
    person.location = { longitude: lng, latitude: lat }
    person.locationUpdated = locationUpdatedDate
    await personRepository.save(person)
    const id = person.entityId

    let keyName = `${person.keyName}:locationHistory`
    await redisClient.xAdd(keyName, '*', { longitude: lng.toString(), latitude: lat.toString() });

    res.send({ id, locationUpdatedDate, location: { lng, lat } })
  }
})

// this is the one we are using for replicating the data from the 
// original go api to the nodejs/redis db api
router.patch('/byName/:name/location/:lng,:lat', async (req, res) => {

  const name = req.params.name
  const lng = Number(req.params.lng)
  const lat = Number(req.params.lat)
  let keyName = '';
  let id = '';

  const locationUpdatedDate = new Date()

  let person = await personRepository.search().where('name').equals(name).return.first()

  if (person == null) {
    //res.send({ "ERROR" : `NO PERSON FOUND BY NAME: ${name}` })
    // CREATE NEW
    person = new Object()
    person.name = name
    person.location = { longitude: lng, latitude: lat }
    person.locationUpdated = locationUpdatedDate
    const savedPerson = await personRepository.createAndSave(person)
    person = savedPerson;

  } else {

    person.location = { longitude: lng, latitude: lat }
    person.locationUpdated = locationUpdatedDate
    await personRepository.save(person)
  }

  id = person.entityId;
  keyName = `${person.keyName}:locationHistory`

  await redisClient.xAdd(keyName, '*', { longitude: lng.toString(), latitude: lat.toString() });

  // GRAPH DATA
  // check if any other device/person is in the vicinity (300 meters) lately (past half hour)
  const nearbyPeople = await personRepository.search()
    .where('location').inRadius(
      circle => circle.origin(lng, lat).radius(300).meters)
    .and('locationUpdated').between(Date.now() - (30 * 60000), locationUpdatedDate).return.all()

  let meetingMembers = [];
  nearbyPeople.forEach(person => {
    console.log(person.name);
    if (person.name !== name) { // exclude the person we just updated the location for
      meetingMembers.push(person);
    }
  });
  // if there any other devices/people nearby, add a meeting to the graph
  if (meetingMembers.length > 0) {
    meetingMembers.push(person); // add the name of the person we updated location to the mmeting
    await updateGraph(meetingMembers, locationUpdatedDate);
  }

  res.send({ id, name, locationUpdatedDate, location: { lng, lat } })
})