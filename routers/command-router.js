import { Router } from 'express'
import { personRepository } from '../om/person.js'

import { default as Redis } from 'ioredis'
import { default as FCM } from 'fcm-node'

const redis = new Redis();
var fcm = new FCM(process.env.FCM_SERVER_API_KEY);


export const router = Router()


var fcmCallbackLog = function (name, keyName, command, httpResponse, err, res) {
    //console.log("\n__________________________________")
    //console.log("\t" + command + " to " + name);
    //console.log("----------------------------------")
    //console.log("err=" + err);
    //console.log("res=" + res);
    //console.log("----------------------------------\n>>>");
    if (err != null) {
        httpResponse.send({ "ERROR": `COULD NOT SENT ${command} TO ${name}` });
    } else {
        // we return the http call
        httpResponse.send({ name, command });
    }

};

router.get('/byName/:name/command/:command', async (req, httpResponse) => {
    const name = req.params.name
    const command = req.params.command

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


            var dataToSend; // Needs to be a Map object
            switch (command) {
                case "TRIGGER_LU":
                    dataToSend = { TRIGGER_LU: '=' };
                    break;
                case "START_TRACKING":
                    dataToSend = { START_TRACKING: '=' };
                    break;
                case "STOP_TRACKING":
                    dataToSend = { STOP_TRACKING: '=' };
            }

            // then push the notification
            var payload = {
                to: person.deviceToken,
                data: dataToSend,
                priority: 'high'
            };

            fcm.send(payload, function (err, res) {
                fcmCallbackLog(name, keyName, command, httpResponse, err, res);
            });
        }
    }
});
