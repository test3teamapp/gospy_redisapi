import { createClient} from 'redis'

/* pulls the Redis URL from .env */
const url = process.env.REDIS_URL
const client = createClient({url});

client.on('error', (err) => console.log('Redis Client Error', err));

await client.connect();

export default client