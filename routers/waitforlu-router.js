import { Router } from 'express'
import { personRepository } from '../om/person.js'

import { default as Redis } from 'ioredis'

const redis = new Redis();


export const router = Router()

const processMessage = (httpResponse, name, message) => {
    // example of received data 
    //Id: 1672875274066-0. Data: [ 'longitude', '21.7267779', 'latitude', '38.2336104' ]
    //console.log("Id: %s. Data: %O", message[0], message[1]);
    httpResponse.send({ name, message });
};

async function listenForMessage(httpResponse, name, streamKeyName, lastId = "$") {
    //console.log("listenForMessage : entry");
    // the dollar sign is a shortcut to "get the record that is written after the latest existing one"
    // `results` is an array, each element of which corresponds to a key.
    // Because we only listen to one key (mystream) here, `results` only contains
    // a single element. See more: https://redis.io/commands/xread#return-value
    const results = await redis.xread("BLOCK", 60000, "STREAMS", streamKeyName, lastId); // wait for 60 seconds
    if (results !== null) {
        //console.log("listenForMessage after triggering LU. received results = %s", results);
        const [key, messages] = results[0]; // `key` equals to "user-stream"
        messages.forEach(element => processMessage(httpResponse, name, element));
    } else {
        //console.log("listenForMessage : exit with no LU received");
        httpResponse.send({ "ERROR": `NO RESPONSE FROM DEVICE : ${name} ` });
    }
}

router.get('/byName/:name', async (req, httpResponse) => {
    const name = req.params.name

    const person = await personRepository.search().where('name').equals(name).return.first()

    //console.log(JSON.stringify(person.deviceToken))
    if (person == null) {
        //console.log("ERROR :" + `NO PERSON FOUND BY NAME: ${name}`)
        httpResponse.send({ "ERROR": `NO PERSON FOUND BY NAME: ${name}` });
    } else if (person.deviceToken == null) {
        httpResponse.send({ "ERROR": `NO DEVICE TOKEN REGISTERED YET TO : ${name}` });
    } else {

        let keyName = `${person.keyName}:locationHistory`
        // check if there are any entries
        const numOfTracks = await redis.xlen(keyName);
        if (numOfTracks == 0) {
            httpResponse.send({ "ERROR": `NOT ENOUGH DATA FOR ${name}` });
        } else {
            // start an observer of the stream, so that we now if a location update is received
            listenForMessage(httpResponse, name, keyName);
            // wait for the stream consumer we initiated to respond to http request
        }
    }
})
