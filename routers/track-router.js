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
      const jsonObj = await redis.xrange(keyName, "-", "+", "COUNT", 1)
  
      res.send(jsonObj)
    }
  })