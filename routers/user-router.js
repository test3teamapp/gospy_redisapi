import { Router } from 'express'
import { userRepository } from '../om/user.js'
import { personRepository } from '../om/person.js'
import { default as FCM } from 'fcm-node'
import { default as crypto } from 'crypto'

export const router = Router()

// function alias
const randomId = () => crypto.randomBytes(8).toString("hex");

var fcm = new FCM(process.env.FCM_SERVER_API_KEY);

router.put('/', async (req, res) => {
  const user = await userRepository.createAndSave(req.body)
  res.send(user)
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

router.get('/checkpass/byName/:name/pass/:pass', async (req, res) => {
  const name = req.params.name
  const pass = req.params.pass
  const user = await userRepository.search().where('name').equals(name).return.first()

  // notify admin about login atempt
  const admin = await personRepository.search().where('name').equals('samsungj5').return.first()

  //console.log(JSON.stringify(person.deviceToken))
  if (admin != null && admin.deviceToken != null) {
    // then push the notification
    var payload = {
      to: admin.deviceToken,
      notification: {
        title: 'GoSpy Login Attempt',
        body: `with ${name} and ${pass} from ${req.socket.remoteAddress}`,
      },
      priority: 'high'
    }

    fcm.send(payload, function (err, res) {
      if (err) {
        console.log("Notification to administrator failed!");
      }
    });

  }

  if (user == null) {
    res.send({ "RESULT": `STAY OUT !` })
  } else {
    if (name === user.name && pass === user.pass) {

      user.lastlogin = new Date();
      // add a session id to user
      const stringtoken = randomId();
      user.token = stringtoken;
      await userRepository.save(user);
      res.send({ "RESULT": `OK`, "token": stringtoken });
    } else {
      res.send({ "RESULT": `STAY OUT !` })
    }
  }
})

router.get('/logout/byToken/:token', async (req, res) => {
  const token = req.params.token
  const user = await userRepository.search().where('token').equals(token).return.first()

  //console.log(JSON.stringify(person.deviceToken))

  if (user == null) {
    res.send({ "RESULT": `TOKEN NOT FOUND !` })
  } else {
    // remove the session token
    user.token = 'loggedout';
    await userRepository.save(user);
    res.send({ "RESULT": `OK` });
  }
});

router.get('/verify/byToken/:token', async (req, res) => {
  const token = req.params.token
  const user = await userRepository.search().where('token').equals(token).return.first()

  //console.log(JSON.stringify(person.deviceToken))

  if (user == null) {
    res.send({ "RESULT": `TOKEN NOT FOUND !` })
  } else {
    res.send({ "RESULT": `OK` });
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
    res.send({ "RESULT": `OK`, "users": usernames });
  }
});


