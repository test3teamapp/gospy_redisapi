import { Router } from 'express'
import { personRepository } from '../om/person.js'

export const router = Router()

router.get('/all', async (req, res) => {
    const persons = await personRepository.search().return.all()
    res.send(persons)
  })

router.get('/by-name/:name', async (req, res) => {
    const name = req.params.name
    const persons = await personRepository.search()
      .where('name').equals(name).return.all()
    res.send(persons)
  })

router.get('/by-token/:token', async (req, res) => {
    const token = req.params.token
    const persons = await personRepository.search()
      .where('deviceToken').equals(token).return.all()
    res.send(persons)
  })

  router.get('/near/:lng,:lat/radius/:radius', async (req, res) => {
    const longitude = Number(req.params.lng)
    const latitude = Number(req.params.lat)
    const radius = Number(req.params.radius)
  
    const persons = await personRepository.search()
      .where('location')
        .inRadius(circle => circle
            .longitude(longitude)
            .latitude(latitude)
            .radius(radius)
            .kilometers)
          .return.all()
  
    res.send(persons)
  })