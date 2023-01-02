import { Router } from 'express'
import { personRepository } from '../om/person.js'
import { connection } from '../om/redisDB_client.js'

export const router = Router()

router.patch('/byID/:id/location/:lat:lng', async (req, res) => {

  const id = req.params.id
  const longitude = Number(req.params.lng)
  const latitude = Number(req.params.lat)

  const locationUpdated = new Date()

  const person = await personRepository.fetch(id)

  if (person.id == null) {
    res.send({ "ERROR" : `NO PERSON FOUND BY ID: ${id}` })
  } else {
    person.location = { longitude, latitude }
    person.locationUpdated = locationUpdated
    await personRepository.save(person)

    let keyName = `${person.keyName}:locationHistory`
    await connection.xAdd(keyName, '*', person.location)


    res.send({ id, locationUpdated, location: { longitude, latitude } })
  }
})

router.patch('/byName/:name/location/:lng,:lat', async (req, res) => {

  const name = req.params.name
  const longitude = Number(req.params.lng)
  const latitude = Number(req.params.lat)

  const locationUpdated = new Date()

  const person = await personRepository.search().where('name').equals(name).return.first()

  if (person == null) {
    //res.send({ "ERROR" : `NO PERSON FOUND BY NAME: ${name}` })
    const person = new Object()
    person.name = name
    person.location = { longitude, latitude }
    person.locationUpdated = locationUpdated
    const savedPerson = await personRepository.createAndSave(person)
    const id = savedPerson.id
    res.send({ id, name, locationUpdated, location: { longitude, latitude } })
    
  } else {
    const id = person.id
    person.location = { longitude, latitude }
    person.locationUpdated = locationUpdated
    await personRepository.save(person)

    let keyName = `${person.keyName}:locationHistory`
    await connection.xAdd(keyName, '*', person.location)


    res.send({ id, name, locationUpdated, location: { longitude, latitude } })
  }
})