import { Router } from 'express'
import { userRepository } from '../om/user.js'

export const router = Router()

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

  if (user == null) {
    res.send({ "RESULT": `STAY OUT !` })
  } else {
    if (name === user.name && pass === user.pass) {
      res.send({"RESULT": `OK`});
    }else{
      res.send({ "RESULT": `STAY OUT !` })
    }
  }
})