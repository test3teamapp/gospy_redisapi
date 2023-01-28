import { Server } from 'socket.io'
import { default as http } from 'http'

const io = new Server(3000, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


io.on("connection", (socket) => {
    socket.sendBuffer = [];

    console.log("a socket connected : " + socket.id);

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
        if ((socket.username != undefined) && (socket.token != undefined)) {
            socket.sendBuffer = [];
            console.log(message);
            const msgObj = JSON.parse(message);
            if (msgObj.to === "all") {
                io.volotile.emit('message', message);
            } else {
                io.in(msgObj.to).volatile.emit('message', message);
            }
        }
    });

    // user logged out, disconnect socket
    socket.on("logout", async () => {
        console.log("user logged out. disconnect socket : " + socket.username);
        // handling for the chat status in db is doen by the api in this case.
        // the user pressed the logou button, so an api call has been made
        // and the user token is cleared and the chat status is turned to offline
        if ((socket.username != undefined) && (socket.token != undefined)) {
            // make all Socket instances in the "room1" room disconnect (and close the low-level connection)
            io.in(socket.username).disconnectSockets(true);
        }
    });

    socket.on("disconnect", async () => {
        // this is the case where the connection might have been interrupted
        // e.g. user closed the browser
        // it has not necessary loggout out, but we need to update
        // the chat status to offline in the db

        if (socket.username && socket.token) {
            // change chat status for user in db
            http.get({
                hostname: 'localhost',
                port: 8085,
                path: '/userrepo/setchatstatus/offline/byToken/' + socket.token,
                agent: false,  // Create a new agent just for this one request
            }, (res) => {
                // Do stuff with response
            });
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
        }

    });


});