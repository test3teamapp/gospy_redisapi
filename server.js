import 'dotenv/config'

import express from 'express'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import cors from 'cors'


/* import routers */
import { router as personRouter } from './routers/person-router.js'
import { router as searchRouter } from './routers/search-router.js'
import { router as locationRouter } from './routers/location-router.js'
import { router as trackRouter } from './routers/track-router.js'
import { router as commandRouter } from './routers/command-router.js'
import { router as graphRouter } from './routers/graph-router.js'
import { router as userRouter } from './routers/user-router.js'

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

/* set up swagger in the root */
const swaggerDocument = YAML.load('gospyapi.yaml')
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

/* start the server */
app.listen(8084)
