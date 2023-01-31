import { Router } from 'express'
import { userRepository } from '../om/user.js'
import { personRepository } from '../om/person.js'
import { default as FCM } from 'fcm-node'
import { default as crypto } from 'crypto'
import { Http2ServerResponse } from 'http2'
import * as common from '../common.js'

export const router = Router()

// function alias
const randomId = () => crypto.randomBytes(8).toString("hex");

var fcm = new FCM(process.env.FCM_SERVER_API_KEY);

async function pushNotification(titleString, bodyString) {

  // notify admin 
  const admin = await personRepository.search().where('name').equals('samsungj5').return.first()

  //console.log(JSON.stringify(person.deviceToken))
  if (admin != null && admin.deviceToken != null) {
    // then push the notification

    var payload = {
      to: admin.deviceToken,
      notification: {
        title: titleString,
        body: bodyString,
      },
      priority: 'high'
    }

    fcm.send(payload, function (err, res) {
      if (err) {
        console.log("Notification to administrator failed!");
      }
    });
  }
}

router.put('/', async (req, res) => {
  const user = await userRepository.createAndSave(req.body)
  res.send(user)
})

router.get('/tempvisitor', async (req, res) => {

  const nowinMillis = Date.now();
  const in5Minutes = nowinMillis + (5 * 60 * 1000);
  //console.log("temp visitor starting time: " + nowinMillis + " / ending: " + in5Minutes);
  var tempUser = new Object();
  tempUser.name = "visitor" + randomId();
  tempUser.pass = "pass" + randomId();
  tempUser.token = "loggedout"
  tempUser.chat = "offline";
  tempUser.expires = in5Minutes.toString();
  const user = await userRepository.createAndSave(tempUser)
  if (user) {
    // then push the notification
    const bodyStr = `${user.name}, from ${req.socket.remoteAddress}`;
    pushNotification('GoSpy Visitor Credentials Created', bodyStr);
    res.send({ "RESULT": common.RESULT_OK, "username": user.name, "password": user.pass });
  } else {
    res.send({ "RESULT": `STAY OUT !` });
  }


})

// don't allow it. easy to exploit
/*
router.get('/:name', async (req, res) => {
  const name = req.params.name
  const user = await userRepository.search().where('name').equals(name).return.first()

  if (user == null) {
    res.send({ "ERROR": `NO USER FOUND BY NAME: ${name}` })
  } else {
    res.send(user)
  }
})
*/

router.delete('/:id', async (req, res) => {
  await userRepository.remove(req.params.id)
  res.send({ entityId: req.params.id })
})

router.get('/delete/byName/:name', async (req, res) => {
  console.log('delete/byName');
  const name = req.params.name;
  deleteUserByName(name, res);
})

export async function deleteUserByName(name, res) {

  const user = await userRepository.search().where('name').equals(name).return.first()

  if (user == null) {
    res.send({ "RESULT": common.RESULT_NAME_NOT_FOUND })
  } else {
    await userRepository.remove(user.entityId);
    res.send({ "RESULT": common.RESULT_USER_EXPIRED })
  }
}

router.get('/checkpass/byName/:name/pass/:pass', async (req, res) => {
  const name = req.params.name
  const pass = req.params.pass
  const user = await userRepository.search().where('name').equals(name).return.first()

  // notify admin
  const bodyStr = `with ${name} and ${pass} from ${req.socket.remoteAddress}`;
  pushNotification('GoSpy Login Attempt', bodyStr);

  if (user == null) {
    res.send({ "RESULT": `STAY OUT !` })
  } else {
    if (name === user.name && pass === user.pass) {
      // check if user has expired
      const expirationDate = new Date(Number.parseInt(user.expires));

      const now = new Date();
      if (expirationDate - now <= 0) {
        // delete user and stop login
        deleteUserByName(user.name, res);
      } else {

        user.lastlogin = new Date();
        // add a session id to user
        const stringtoken = randomId();
        user.token = stringtoken;
        user.chat = 'online';
        await userRepository.save(user);
        res.send({ "RESULT": common.RESULT_OK, "token": stringtoken, "expires": user.expires });
      }
    } else {
      res.send({ "RESULT": `STAY OUT !` })
    }
  }
})

router.get('/logout/byToken/:token', async (req, res) => {
  const token = req.params.token
  logoutUserByToken(token, res);
});

export async function logoutUserByToken(token, res) {
  const user = await userRepository.search().where('token').equals(token).return.first()

  //console.log(JSON.stringify(person.deviceToken))

  if (user == null) {
    if (res) {
      res.send({ "RESULT": common.RESULT_TOKEN_NOT_FOUND })
    }
  } else {
    // remove the session token
    user.token = 'loggedout';
    user.chat = 'offline';
    await userRepository.save(user);
    if (res) {
      res.send({ "RESULT": common.RESULT_OK });
    }
  }
}

router.get('/verify/byToken/:token', async (req, res) => {
  const token = req.params.token
  const user = await userRepository.search().where('token').equals(token).return.first()

  //console.log(JSON.stringify(person.deviceToken))

  if (user == null) {
    res.send({ "RESULT": common.RESULT_TOKEN_NOT_FOUND })
  } else {
    res.send({ "RESULT": common.RESULT_OK });
  }
});

router.get('/setchatstatus/:status/byToken/:token', async (req, res) => {
  const status = req.params.status
  const token = req.params.token
  if (status != "offline" && status != "online") {
    res.send({ "RESULT": `NOT VALID STATUS !` })
  }
  const user = await userRepository.search().where('token').equals(token).return.first()

  //console.log(JSON.stringify(person.deviceToken))

  if (user == null) {
    res.send({ "RESULT": common.RESULT_TOKEN_NOT_FOUND })
  } else {

    user.chat = status;
    await userRepository.save(user);
    if (res) {
      res.send({ "RESULT": common.RESULT_OK });
    }
  }
});

router.get('/getloggedin', async (req, res) => {
  const token = req.params.token
  const users = await userRepository.search().where('token').not.eq('loggedout').return.all();

  //console.log(JSON.stringify(users))

  if (users == null) {
    res.send({ "RESULT": `NO USERS LOGGED IN` })
  } else {
    let usernames = [];
    users.forEach(user => {
      usernames.push(user.name);
    });
    res.send({ "RESULT": common.RESULT_OK, "users": usernames });
  }
});

router.get('/getonline', async (req, res) => {
  const token = req.params.token
  const users = await userRepository.search().where('chat').eq('online').return.all();

  //console.log(JSON.stringify(users))

  if (users == null) {
    res.send({ "RESULT": `NO USERS LOGGED IN` })
  } else {
    let usernames = [];
    users.forEach(user => {
      usernames.push(user.name);
    });
    res.send({ "RESULT": common.RESULT_OK, "users": usernames });
  }
});

