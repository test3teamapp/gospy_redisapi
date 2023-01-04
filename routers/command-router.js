import { Router } from 'express'
import { personRepository } from '../om/person.js'

import { default as Redis } from 'ioredis'
import { default as FCM } from 'fcm-node'

const redis = new Redis();
var fcm = new FCM(process.env.FCM_SERVER_API_KEY);


export const router = Router()

const processMessage = (htmlResponse, name, message) => {
    // example of received data 
    //Id: 1672875274066-0. Data: [ 'longitude', '21.7267779', 'latitude', '38.2336104' ]
    console.log("Id: %s. Data: %O", message[0], message[1]);
    htmlResponse.send({name, message});
};

async function listenForMessage(htmlResponse, name, streamKeyName, lastId = "$") { 
    console.log("listenForMessage : entry");
    // the dollar sign is a shortcut to "get the record that is written after the latest existing one"
    // `results` is an array, each element of which corresponds to a key.
    // Because we only listen to one key (mystream) here, `results` only contains
    // a single element. See more: https://redis.io/commands/xread#return-value
    const results = await redis.xread("BLOCK", 60000, "STREAMS", streamKeyName, lastId); // wait for 60 seconds
    if(results !== null){
        console.log("listenForMessage after triggering LU. received results = %s",results);
        const [key, messages] = results[0]; // `key` equals to "user-stream"
        messages.forEach(element => processMessage(htmlResponse, name,element ));
    }else {        
        console.log("listenForMessage : exit with no LU received");
        htmlResponse.send({"ERROR": `NO RESPONSE FROM DEVICE : ${name} ` });
    }
}

var fcmCallbackLog = function (sender, err, res) {
    console.log("\n__________________________________")
    console.log("\t"+sender);
    console.log("----------------------------------")
    console.log("err="+err);
    console.log("res="+res);
    console.log("----------------------------------\n>>>");
};

router.get('/byName/:name/command/:command', async (req, res) => {
    const name = req.params.name
    const command = req.params.command

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

            
            var dataToSend; // Needs to be a Map object
            if (command === "TRIGGER_LU"){
                // first start an observer of the stream, so that we now if a location update is received
                listenForMessage(res,name,keyName);
                dataToSend = {TRIGGER_LU: '='};
            }
            if (command === "START_TRACKING") dataToSend = {START_TRACKING: '='};
            if (command === "STOP_TRACKING") dataToSend = {STOP_TRACKING: '='};
            
            // then push the notification
            var payload = {
                to: person.deviceToken,
                data: dataToSend,
                priority: 'high'
            };
            
            fcm.send(payload,function(err,res){
                fcmCallbackLog('sendOK',err,res);
            });
            // if triggering LU, wait for the stream consumer we initiated to respond
            if (command !== "TRIGGER_LU") res.send({ name, command })
        }
    }
})
