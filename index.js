const express = require('express');
const http = require('http')
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const server = http.createServer(app);
const socketIo = require('socket.io');

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

const DATA_PATH = path.resolve('./data.json');
const ID_PATH = path.resolve('./id.txt');

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000', // Allow requests from this domain
  optionsSuccessStatus: 200 // Set the status code for successful preflight requests
}));

function writeToFile(data) {
  fs.writeFile(DATA_PATH, JSON.stringify(data, undefined, 2), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log('Data written to file successfully');
    }
  });
}

app.get('/allMessages', (req, res) => {
  fs.promises.readFile(DATA_PATH, 'utf8').then((dataStream) => {
    const data = JSON.parse(dataStream || "{}");
    res.send(data.messages || []);
  });
});

app.get('/onlineUsers', (req, res) => {
  fs.promises.readFile(DATA_PATH, 'utf8').then((dataStream) => {
    const data = JSON.parse(dataStream);
    res.send(data.users);
  });
});

app.get('/getId', (req, res) => {
  fs.promises.readFile(ID_PATH, 'utf8').then((id) => {
    res.send(id);
    fs.promises.writeFile(ID_PATH, String(Number(id) + 1));
  });
});

io.on('connection', (socket) => {
  socket.on('message', (message) => {
    fs.promises.readFile(DATA_PATH, 'utf8').then((dataStream) => {
      const data = JSON.parse(dataStream);
      data.messages.push(message);
      socket.broadcast.emit('getMessages', data.messages);
      writeToFile(data);
    });
  });

  socket.on('createUser', ({name, img, id}) => {
    fs.promises.readFile(DATA_PATH, 'utf8').then((dataStream) => {
      const data = JSON.parse(dataStream);
      data.users.push({
        name,
        img,
        id: socket.id,
        isTyping: false,
        userId: id
      });
      socket.broadcast.emit('createUser', data.users);
      writeToFile(data);
    });
  });

  socket.on('isTyping', ({ socketId, isTyping }) => {
    socket.broadcast.emit('isTyping', { socketId, isTyping });
  });

  socket.on('disconnect', () => {
    fs.promises.readFile(DATA_PATH, 'utf8').then((dataStream) => {
      const data = JSON.parse(dataStream);
      const filteredUsers = data.users.filter(user => user.id !== socket.id);
      socket.broadcast.emit('createUser', filteredUsers);
      writeToFile({ ...data, users: filteredUsers });
    });
  });
});

server.listen(5000, () => {
  console.log('PORT --> 5000 RUN')
});