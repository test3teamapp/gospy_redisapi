import { Router } from 'express'
import { personRepository } from '../om/person.js'

import { default as Redis } from 'ioredis'
import { meetingsGraph } from '../om/redisGraph_client.js'

const redis = new Redis();

export const router = Router()


router.get('/latest/byName/:name/hours/:hours', async (req, res) => {
    const name = req.params.name
    const hours = Number(req.params.hours)

    const person = await personRepository.search().where('name').equals(name).return.first()

    //console.log(JSON.stringify(person))
    if (person == null) {
        //console.log("ERROR :" + `NO PERSON FOUND BY NAME: ${name}`)
        res.send({ "ERROR": `NO PERSON FOUND BY NAME: ${name}` })
    } else {

        // check if there are any other meetings taking place in the area already
        let timestampNow = Date.now();
        const timestamp1HourAgo = timestampNow - (hours * 60 * 60000); // past hour

        const graphResult = await meetingsGraph.roQuery(
            'MATCH (m:Meeting) , (pl:Place) , (allp:Person ), (p:Person {name: $name}) \
  WHERE (m)-[:AT_PLACE]->(pl)  AND (p)-[:PART_OF]->(m)\
  AND (allp)-[:PART_OF]->(m) \
  AND m.date > $tPastHour RETURN COLLECT(allp) AS allp, m, pl  ORDER BY m.date DESC',
            {
                params: {
                    name: name,
                    tPastHour: timestamp1HourAgo
                }
            }
        );
        res.send({ name, graphResult })

    }
})