import { Entity, Schema } from 'redis-om'
import { default as redisOMClient } from './redisOM_client.js'

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
export const personRepository = redisOMClient.fetchRepository(personSchema)

/* create the index for Person */
await personRepository.createIndex()
