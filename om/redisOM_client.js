import { Client } from 'redis-om'

/* pulls the Redis URL from .env */
const url = process.env.REDIS_URL
const clientOM = new Client()
await clientOM.open('redis://localhost:6379')

export default clientOM