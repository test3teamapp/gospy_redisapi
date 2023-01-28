import { Entity, Schema } from 'redis-om'
import { default as redisOMClient } from './redisOM_client.js'

/* our entity */
class User extends Entity {}

/* create a Schema for Person */
const userSchema = new Schema(User, {
    name: { type: 'string' },
    pass: { type: 'string' },
    lastlogin: { type: 'date' },
    token: { type: 'string' },
    chat: {type: 'string'}
  })

  /* use the client to create a Repository just for Persons */
export const userRepository = redisOMClient.fetchRepository(userSchema)

/* create the index for Person */
await userRepository.createIndex()
