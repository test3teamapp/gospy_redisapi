import { Router } from 'express'
import { personRepository } from '../om/person.js'

import { default as Redis } from 'ioredis'
import { meetingsGraph } from '../om/redisGraph_client.js'

const redis = new Redis();

export const router = Router()

// latest meeting by name
router.get('/latest/byName/:name/hours/:hours', async (req, res) => {
    const name = req.params.name
    const hours = Number(req.params.hours)

    const person = await personRepository.search().where('name').equals(name).return.first()

    //console.log(JSON.stringify(person))
    if (person == null) {
        //console.log("ERROR :" + `NO PERSON FOUND BY NAME: ${name}`)
        res.send({ "ERROR": `NO PERSON FOUND BY NAME: ${name}` })
    } else {

        let timestampNow = Date.now();
        const timestampAgo = timestampNow - (hours * 60 * 60000); // past hour(s)

        const graphResult = await meetingsGraph.roQuery(
            'MATCH (m:Meeting) , (pl:Place) , (allp:Person ), (p:Person {name: $name}) \
  WHERE (m)-[:AT_PLACE]->(pl)  AND (p)-[:PART_OF]->(m)\
  AND (allp)-[:PART_OF]->(m) \
  AND m.date > $tPastHour RETURN COLLECT(allp) AS allp, m, pl  ORDER BY m.date DESC',
            {
                params: {
                    name: name,
                    tPastHour: timestampAgo
                }
            }
        );
        res.send({ name, graphResult })

    }
})

// places user had meetings with counters
router.get('/count/places/byName/:name/months/:months', async (req, res) => {
    const name = req.params.name
    const months = Number(req.params.months)

    const person = await personRepository.search().where('name').equals(name).return.first()

    //console.log(JSON.stringify(person))
    if (person == null) {
        //console.log("ERROR :" + `NO PERSON FOUND BY NAME: ${name}`)
        res.send({ "ERROR": `NO PERSON FOUND BY NAME: ${name}` })
    } else {

        let timestampNow = Date.now();
        const timestampAgo = timestampNow - (months * 30 * 24 * 60 * 60000); // past month(s)

        const graphResult = await meetingsGraph.roQuery(
            'MATCH (m:Meeting) , (pl:Place) , (p:Person {name: $name}) \
  WHERE (m)-[:AT_PLACE]->(pl)  AND (p)-[:PART_OF]->(m)\
  AND m.date > $tPastHour RETURN pl as place, COUNT(m) as placeCount ORDER BY placeCount DESC',
            {
                params: {
                    name: name,
                    tPastHour: timestampAgo
                }
            }
        );
        res.send({ name, graphResult })

    }
})

// friend of friend of user 
router.get('/fof/byName/:name', async (req, res) => {
    const name = req.params.name

    const person = await personRepository.search().where('name').equals(name).return.first()
    var tempFriendSet = [];

    //console.log(JSON.stringify(person))
    if (person == null) {
        //console.log("ERROR :" + `NO PERSON FOUND BY NAME: ${name}`)
        res.send({ "ERROR": `NO PERSON FOUND BY NAME: ${name}` })
    } else {

        var graphResult = await meetingsGraph.roQuery(
            'MATCH (p:Person {name: $name})-[:PART_OF]->(m1:Meeting)<-[:PART_OF]-(f:Person) \
            WHERE (f.name <> $name) RETURN DISTINCT f.name as friend',
            {
                params: {
                    name: name
                }
            }
        );
        if (graphResult.ERROR) { // if there was an error, we just return the error
            // not the result we expected
            //console.log(" outer.get('/fof/byName/:" + name + ": Response of 1st call : " + graphResult.ERROR);
            graphResult['friends'] = tempFriendSet;
            res.send({ name, graphResult })
        } else {
            // we have a set of first level connections (could be 0 if the person has no meetings)

            if (graphResult.data.length == 0) {
                graphResult['friends'] = tempFriendSet;
                res.send({ name, graphResult });
            } else {
                graphResult.data.forEach(f => {
                    tempFriendSet.push(f.friend);
                });
                //console.log(" outer.get('/fof/byName/:" + name + ":Friends list : " + tempFriendSet);

                graphResult = await meetingsGraph.roQuery(
                    'UNWIND $friendsList as friend\
                         MATCH (p:Person {name: friend})-[:PART_OF]->(m1:Meeting)<-[:PART_OF]-(fof:Person) \
                         WHERE (fof.name <> $name) AND NOT ANY( f IN $friendsList WHERE (fof.name = f)) \
                         RETURN DISTINCT friend, fof.name as fof',
                    {
                        params: {
                            friendsList: tempFriendSet,
                            name: name
                        }
                    }
                );
                //console.log(" outer.get('/fof/byName/:" + name + ":Response of 2nd call : " + JSON.stringify(graphResult));

                if (!graphResult.data) { // if there was an error, we just return the error
                    // not the result we expected
                    //console.log(" outer.get('/fof/byName/:name': Response of 2nd call : " + graphResult);
                    res.send({ name, ERROR: 'NO RESULT FOR FRIENDS OF FRIENDS' });
                } else if (graphResult.ERROR) { // if there was an error, we just return the error
                    // not the result we expected
                    //console.log(" outer.get('/fof/byName/:name': Response of 2nd call : " + graphResult.ERROR);
                    graphResult['friends'] = tempFriendSet;
                    res.send({ name, graphResult });
                } else {
                    graphResult['friends'] = tempFriendSet; 
                    res.send({ name, graphResult });
                }

            }

        }
    }
})