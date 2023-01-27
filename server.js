import 'dotenv/config'

import express from 'express'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import cors from 'cors'
import { Server } from 'socket.io'
import { default as crypto } from 'crypto'
import { logoutUserByToken } from './routers/user-router.js'
// function alias
const randomId = () => crypto.randomBytes(8).toString("hex");

const io = new Server(3000, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


io.on("connection", (socket) => {
    socket.sendBuffer = [];

    console.log("a socket connected : " + socket.id);

    socket.emit("whoAreU");

    socket.on("setUsername", (username, token) => {
        socket.username = username;
        socket.token = token;
        io.socketsLeave(username);
        socket.join(username); // joins a room by the username, so we can singlecast sent messages
        console.log(socket.id + " : username = " + socket.username + " / token = " + token);
        const conMsg = {
            from: "system",
            to: "all",
            message: "user " + socket.username + " joined chat",
            event: {
                type: "connect",
                user: socket.username
            }
        }

        io.emit("message", JSON.stringify(conMsg));
    });

    socket.on('message', (message) => {
        socket.sendBuffer = [];
        console.log(message);
        const msgObj = JSON.parse(message);
        if (msgObj.to === "all") {
            io.volotile.emit('message', message);
        } else {
            io.in(msgObj.to).volatile.emit('message', message);
        }
    });

    // user logged out, disconnect socket
    socket.on("logout", async () => {
        console.log("user logged out. disconnect socket : " + socket.username);
        if (socket.username && socket.token) {
            // make all Socket instances in the "room1" room disconnect (and close the low-level connection)
            io.in(socket.username).disconnectSockets(true);
        }
    });

    socket.on("disconnect", async () => {

        if (socket.username && socket.token) {
            // make all Socket instances in the "room1" room disconnect (and close the low-level connection)
            io.in(socket.username).disconnectSockets(true);
            console.log("socket disconnected : " + socket.username);
            const discMsg = {
                from: "system",
                to: "all",
                message: "user " + socket.username + " left chat",
                event: {
                    type: "disconnect",
                    user: socket.username
                }
            }

            io.emit("message", JSON.stringify(discMsg));
            // delete all session records for this user. 
            //logoutUserByToken(socket.token, null); // NEEDS THINKING
        }

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
app.listen(8084)
