const app = require("express")();
const server = app.listen(3000, () => {});
const SocketIO = require("socket.io");
const io = SocketIO(server, {path:"/socket.io"});
const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();
const connection = mysql.createConnection({
  host:'localhost',
  user:'root',
  port:'3306',
  password:process.env.mySQl_PW,
  database:'socketio',
})

connection.connect();
connection.query(
  "delete from rooms",(err, result)=>{
    if(!err){console.log("DB<rooms> was reset");}
    else{throw(err);};
  }
);
connection.query(
  "delete from webchat",(err,result)=>{
    if(!err){console.log("DB<webchat> was reset");}
    else{throw(err);};
  }
)

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
        [msg['userId'],msg['msg'],msg['time'],msg['room']], (err) =>{
          if(!err){
            console.log("data inserted in <webchat>");
            connection.query(
              "SELECT * FROM webchat WHERE room = ? order by cast(id as char)",[msg['room']],(err, result)=>{
                console.log("data found");
                socket.emit("msg", result);
                socket.broadcast.emit("msg",result);
                console.log(result);
              }
            )
          }else{throw(err);};
        }
      );

      ////use global variable for save msgLog code
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
  connection.query(
    "select room from rooms group by room",(err, result)=>{
      nameSpace = result;
      nameSpace = nameSpace.map(rooms => rooms.room);
      console.log(nameSpace);
      return;
    }
  );
  
  socket.on("create",(roomInfo)=>{
  const roomName = encodeURI(roomInfo['roomName']);
  if(nameSpace.includes(roomName)){
    console.log("join room :"+roomName);
    socket.emit("created", roomName);
    return;
  }
    
  //nameSpace.push(roomName);
  connection.query(
    "insert into rooms (room) value (?)",[roomName],()=>{
      console.log("saved roomName");
    }
  );
  console.log("create room :"+roomName);
  createRoom(roomName);
  socket.emit("created", roomName);
  return;
  }
  );
})
    
createRoom("default");