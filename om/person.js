import { Entity, Schema } from 'redis-om'
import client from './redisDB_client.js'

/* our entity */
class Person extends Entity {}

/* create a Schema for Person */
const personSchema = new Schema(Person, {
    name: { type: 'string' },
    location: { type: 'point' },
    locationUpdated: { type: 'date' },
    deviceToken: {type: 'string'}
  })

  /* use the client to create a Repository just for Persons */
export const personRepository = client.fetchRepository(personSchema)

/* create the index for Person */
await personRepository.createIndex()
