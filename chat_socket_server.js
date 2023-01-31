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
    //io.in(username).disconnectSockets(true); // remove other socket created by previous loggins by user

    console.log("a socket connected : " + socket.id);

    function checkForExpiredUser() {
        socket.emit("sendExpiration");
    }

    const intervalCheckForExpirationObject = setInterval(checkForExpiredUser, 60000); // every minute;

    socket.on("checkExpiration", (expirationStringDateMillis) => {
        
        if (expirationStringDateMillis != "never") {
            console.log("Expiration for user : " + socket.username + " = " + expirationStringDateMillis);
            const expirationDate = new Date(Number.parseInt(expirationStringDateMillis));

            const now = new Date();
            if (expirationDate - now <= 0) {
                socket.emit("expired"); // notify site to logout user
                // remove user from db
                http.get({
                    hostname: 'localhost',
                    port: 8084,
                    path: '/userrepo/delete/byName/' + socket.username,
                    agent: false,  // Create a new agent just for this one request
                }, (res) => {
    
                    if (res.RESULT != "OK") {
                       console.error("temporary user " + socket.username + " could not be deleted after expiration");
                    }
                });
            }
        }
    });

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

    socket.on("disconnect", async () => {
        // this is the case where the connection might have been interrupted
        // e.g. user closed the browser
        // it has not necessary loggout out, but we need to update
        // the chat status to offline in the db

        // clear the repeated check fro expiration of user login
        clearInterval(intervalCheckForExpirationObject);

        if (socket.username && socket.token) {
            // check if the disconnect is for the currently logged in user
            http.get({
                hostname: 'localhost',
                port: 8084,
                path: '/userrepo/verify/byToken/' + socket.token,
                agent: false,  // Create a new agent just for this one request
            }, (res) => {

                if (res.RESULT != "OK") {
                    // the user token is not valid.
                    // user mustr have logged in from another browser.
                    // just kill this socket
                    socket.disconnect();
                } else {
                    // change chat status for user in db
                    http.get({
                        hostname: 'localhost',
                        port: 8084,
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
        }

    });


});