const app = require("express")();
const server = app.listen(3000, () => {});
const SocketIO = require("socket.io");
const io = SocketIO(server, {path:"/socket.io"});
const mysql = require("mysql2");
const connection = mysql.createConnection({
  host:'localhost',
  user:'root',
  port:'3306',
  password:'shaan1028!',
  database:'socketio',
})

connection.connect();

function messages(roomName){
  this.roomName = roomName;
  this.msgLog = [];
}

let mainCount = 0;
const rooms = [];
function createRoom(roomName){
  const name = roomName;
  const path = "/"+name;
  const room= io.of(path);
  
  app.get(path, (req,res)=>{
      res.sendFile(__dirname+"/room.html")
  });
  
  const localCount = mainCount;
  mainCount += 1;
  rooms[localCount] = new messages(name);
  const msgLog = rooms[localCount].msgLog;

  room.on("connection", (socket)=>{
    const req = socket.request;
    
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    console.log("new Client Connected", ip, socket.id);

    socket.emit("msg", msgLog);

    socket.on("msg", (msg)=>{
      console.log(`[${msg['time']}]${msg['userId']}: ${msg['msg']}`);

      connection.query(
        "INSERT INTO webchat (userId, msg, time, room) VALUES (?,?,?,?)",
        [msg['userId'],msg['msg'],msg['time'],msg['room']], () =>{
          console.log("data inserted in <webchat>");
          connection.query(
            "SELECT * FROM webchat WHERE room = ?",[msg['room']],(err, result)=>{
              console.log("data found");
              socket.emit("msg", result);
              socket.broadcast.emit("msg",result);
              console.log(result);
            }
          )
        }
      );

      //msgLog.push(msg);
      //socket.emit("msg",msgLog);
      //socket.broadcast.emit("msg", msgLog);
      //console.log(msgLog);
    });

    socket.on("error", (error)=>{
        console.error(error.message);
    });

    socket.on("reply", (data)=>{
        console.log(data);
    });
    
    socket.interval = setInterval(()=>{
        socket.emit("news", "Hello Socket.IO");
    }, 50000);

    socket.on("disconnect", ()=>{
      console.log('Client is Disconnected', ip, socket.id);
      clearInterval(socket.interval);
    });
  });
}

const lobby = io.of("/");
let nameSpace = [];
app.get("/", (req,res)=>{
  res.sendFile(__dirname+"/lobby.html");
})
lobby.on("connection", (socket)=>{
  console.log("lobby connected");
  
  socket.on("create", (roomInfo)=>{
  const roomName = roomInfo['roomName'];
  if(nameSpace.includes(roomName)){
    console.log("join room"+roomName);
    socket.emit("created", roomName);
    return;
  }
  nameSpace.push(roomName);
  console.log("create room :"+roomName);
  createRoom(roomName);
  socket.emit("created", roomName);
})
})
    
createRoom("default");