import 'dotenv/config'

import express from 'express'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import cors from 'cors'
import { default as crypto } from 'crypto'
import { logoutUserByToken } from './routers/user-router.js'
// function alias
const randomId = () => crypto.randomBytes(8).toString("hex");


/* import routers */
import { router as personRouter } from './routers/person-router.js'
import { router as searchRouter } from './routers/search-router.js'
import { router as locationRouter } from './routers/location-router.js'
import { router as trackRouter } from './routers/track-router.js'
import { router as commandRouter } from './routers/command-router.js'
import { router as graphRouter } from './routers/graph-router.js'
import { router as userRouter } from './routers/user-router.js'
import { router as waitforluRouter } from './routers/waitforlu-router.js'

/* create an express app and use JSON */
const app = new express()
app.use(express.json())
app.use(cors());

/* bring in some routers */
app.use('/person', personRouter)
app.use('/locationUpdate', locationRouter)
app.use('/persons', searchRouter)
app.use('/tracking', trackRouter)
app.use('/sendCommand', commandRouter)
app.use('/graph', graphRouter)
app.use('/userrepo', userRouter)
app.use('/waitForLU', waitforluRouter)

/* set up swagger in the root */
//const swaggerDocument = YAML.load('gospyapi.yaml')
//app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument))


/* start the http rs
server */
app.listen(18084) // traefik will open the https entrypoint @ 8084
