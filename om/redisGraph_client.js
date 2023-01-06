import { createClient, Graph } from 'redis'

/* pulls the Redis URL from .env */
const url = process.env.REDIS_URL

const client = createClient();
client.on('error', (err) => console.log('Redis Graph Client Error', err));

await client.connect();

export const meetingsGraph = new Graph(client, 'meetingsGraph');