import { Router } from 'express'
import { personRepository } from '../om/person.js'

import { default as Redis } from 'ioredis'
const redis = new Redis();

export const router = Router()


router.get('/byName/:name/hours/:hours', async (req, res) => {
    const name = req.params.name
    const hours = Number(req.params.hours)

    const person = await personRepository.search().where('name').equals(name).return.first()

    //console.log(JSON.stringify(person))
    if (person == null) {
        //console.log("ERROR :" + `NO PERSON FOUND BY NAME: ${name}`)
        res.send({ "ERROR": `NO PERSON FOUND BY NAME: ${name}` })
    } else {

        let keyName = `${person.keyName}:locationHistory`
        // check if there are any entries
        const numOfTracks = await redis.xlen(keyName);
        if (numOfTracks == 0) {
            res.send({ name, "tracks": [] });
        } else {

            // first get the latest entry in the stream, to establish the range of milliseconds to request
            const jsonObj = await redis.xrevrange(keyName, "+", "-", "COUNT", 1);
            /*
            We could receive something like this:
            [
                [
                "1672482216758-0",
                    [
                    "longitude",
                    "38.2333814",
                    "latitude",
                    "21.7266567"
                    ]
                ]
            ]
            this is the latest timestamp in ms : 1672482216758
            We need to transform hours in ms and substract from the above to get the range of entries requested
            */
            //console.log(`Latest timestamp : ${jsonObj[0][0]}`)
            //console.log(`Latest locations : ${jsonObj[0][1]}`)
            const latestTimestamp = Number(String(jsonObj[0][0]).substring(0, 13))
            //console.log(`Latest timestamp as number: ${latestTimestamp}`)
            const pastTimestamp = latestTimestamp - (hours * 3600000)
            const tracks = await redis.xrange(keyName, pastTimestamp, latestTimestamp)
            res.send({ name, tracks })
        }
    }
})