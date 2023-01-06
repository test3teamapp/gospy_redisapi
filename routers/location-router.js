import { Router } from 'express'
import { personRepository } from '../om/person.js'
import { default as redisClient } from '../om/redisDB_client.js'
import { meetingsGraph } from '../om/redisGraph_client.js'

export const router = Router()

async function updateGraph(personName, ){

}

router.patch('/byID/:id/location/:lat,:lng', async (req, res) => {

  const id = req.params.id
  //console.log(`req.params.lng : ${req.params.lng} , req.params.lat : ${req.params.lat}`)
  const lng = Number(req.params.lng)
  const lat = Number(req.params.lat)

  const locationUpdated = new Date()

  const person = await personRepository.fetch(id)

  if (person.name == null) {
    res.send({ "ERROR" : `NO PERSON FOUND BY ID: ${id}` })
  } else {
    person.location = { longitude: lng, latitude: lat }
    person.locationUpdated = locationUpdated
    await personRepository.save(person)
    const id = person.entityId

    let keyName = `${person.keyName}:locationHistory`
    await redisClient.xAdd(keyName, '*', {longitude: lng.toString(), latitude: lat.toString()});

    res.send({ id, locationUpdated, location: { lng, lat } })
  }
})

router.patch('/byName/:name/location/:lng,:lat', async (req, res) => {

  const name = req.params.name
  const lng = Number(req.params.lng)
  const lat= Number(req.params.lat)

  const locationUpdated = new Date()

  const person = await personRepository.search().where('name').equals(name).return.first()

  if (person == null) {
    //res.send({ "ERROR" : `NO PERSON FOUND BY NAME: ${name}` })
    // CREATE NEW
    const person = new Object()
    person.name = name
    person.location = { longitude:lng, latitude:lat }
    person.locationUpdated = locationUpdated
    const savedPerson = await personRepository.createAndSave(person)
    const id = savedPerson.entityId;

    let keyName = `${savedPerson.keyName}:locationHistory`
    await redisClient.xAdd(keyName, '*', {longitude: lng.toString(), latitude: lat.toString()});

    res.send({ id, name, locationUpdated, location: { lng, lat } })
    
  } else {
    const id = person.entityId
    person.location = { longitude:lng, latitude:lat }
    person.locationUpdated = locationUpdated
    await personRepository.save(person)

    let keyName = `${person.keyName}:locationHistory`
    
    await redisClient.xAdd(keyName, '*', {longitude: lng.toString(), latitude: lat.toString()});

    // GRAPH DATA
    // check if any other device/person is in the vicinity


    //updateGraph();

    res.send({ id, name, locationUpdated, location: { lng, lat } })
  }
})