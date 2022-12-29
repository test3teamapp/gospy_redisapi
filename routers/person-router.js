import { Router } from 'express'
import { personRepository } from '../om/person.js'

export const router = Router()

router.put('/', async (req, res) => {
    const person = await personRepository.createAndSave(req.body)
    res.send(person)
  })

router.get('/:id', async (req, res) => {
    const person = await personRepository.fetch(req.params.id)
    res.send(person)
  })

router.post('/:id', async (req, res) => {

    const person = await personRepository.fetch(req.params.id)
  
    person.name = req.body.name ?? person.name
    person.location = req.body.location ?? person.location
    person.locationUpdated = req.body.locationUpdated ?? person.locationUpdated
    person.deviceToken = req.body.deviceToken ?? person.deviceToken
  
    await personRepository.save(person)
  
    res.send(person)
  })

router.delete('/:id', async (req, res) => {
    await personRepository.remove(req.params.id)
    res.send({ entityId: req.params.id })
  })

router.patch('/updateTokenbyName/:name/token/:token', async (req, res) => {

    const name = req.params.name
    const token = req.params.token
  
    const person = await personRepository.search().where('name').equals(name).return.first()
  
    if (person == null) {
      res.send({ "ERROR" : `NO PERSON FOUND BY NAME: ${name}` })    
    } else {
      const id = person.id
      person.deviceToken = token
      await personRepository.save(person)
  
      res.send({ id, name})
    }
  })