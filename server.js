import 'dotenv/config'

import express from 'express'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import cors from 'cors'
import { Server } from 'socket.io'
import {default as crypto} from 'crypto'
// function alias
const randomId = () => crypto.randomBytes(8).toString("hex");

const io = new Server(3000, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


io.on("connection", (socket) => {

    console.log("a socket connected : " + socket.id);
    socket.username = randomId();
    console.log("a socket connected : username = " + socket.username);

    socket.on("disconnect", () => {
        console.log("socket disconnected : " + socket.username);
        io.emit("chatmsg", "user " + socket.username + " left chat");
        io.emit("disconnect_user", socket.username); // send notice to messages window to close 
        // delete all session records for this user. 
    });
});

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
app.listen(8085)
