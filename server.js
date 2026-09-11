const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const commentsDir = path.join(__dirname, 'comments');
const commentsFile = path.join(commentsDir, 'comments.json');
if (!fs.existsSync(commentsDir)) {
  fs.mkdirSync(commentsDir);
}
if (!fs.existsSync(commentsFile)) {
  fs.writeFileSync(commentsFile, '{}');
}

function readComments() {
  try {
    return JSON.parse(fs.readFileSync(commentsFile, 'utf8'));
  } catch (error) {
    console.error('Comment data read error:', error);
    return {};
  }
}

function writeComments(comments) {
  fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Serve static files (frontend)
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(cors());
app.use(express.json());

// In-memory task storage
let tasks = [];

// Upload task
app.post('/upload', upload.single('taskFile'), (req, res) => {
  const savedFileName = req.file.filename; // ✅ unique filename
  const taskId = Date.now();
  const task = {
    id: taskId,
    userName: req.body.userName,
    description: req.body.description,
    fileName: req.file.originalname,       // original name for display
    fileUrl: '/download/' + taskId,
    filePath: req.file.path,               // filesystem path for deletion
    status: 'pending',
    sendTo: req.body.sendTo || 'public'
  };
  tasks.push(task);
  res.json({ message: 'Task submitted!' });
});

// Download a task file with the sender mark in its downloaded filename
app.get('/download/:id', (req, res) => {
  const task = tasks.find(item => item.id == req.params.id);
  if (!task || !fs.existsSync(task.filePath)) {
    return res.status(404).json({ message: 'File not found.' });
  }

  const downloadName = `by-ST-${path.basename(task.fileName)}`;
  res.download(task.filePath, downloadName);
});

// Get all tasks
app.get('/tasks', (req, res) => {
  res.json(tasks);
});

// Get public tasks only
app.get('/tasks/public', (req, res) => {
  res.json(tasks.filter(t => t.sendTo === 'public'));
});

// Get Zei tasks only
app.get('/tasks/zei', (req, res) => {
  res.json(tasks.filter(t => t.sendTo === 'zei'));
});

// Get comments for a task
app.get('/comments/:taskId', (req, res) => {
  const comments = readComments();
  res.json(comments[req.params.taskId] || []);
});

// Add a comment to a task
app.post('/comments/:taskId', (req, res) => {
  const userName = String(req.body.userName || '').trim();
  const text = String(req.body.text || '').trim();
  const isAdmin = req.body.isAdmin === true;

  if (!userName || !text) {
    return res.status(400).json({ message: 'Name and comment are required.' });
  }
  if (userName.length > 80 || text.length > 1000) {
    return res.status(400).json({ message: 'Name or comment is too long.' });
  }
  if (!tasks.some(task => task.id == req.params.taskId)) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  const comments = readComments();
  const taskComments = comments[req.params.taskId] || [];
  taskComments.push({
    id: Date.now(),
    userName,
    text,
    isAdmin,
    createdAt: new Date().toISOString()
  });
  comments[req.params.taskId] = taskComments;
  writeComments(comments);
  res.status(201).json(taskComments[taskComments.length - 1]);
});

// Mark task done
app.post('/done/:id', (req, res) => {
  tasks = tasks.map(t => t.id == req.params.id ? { ...t, status: 'done' } : t);
  res.json({ message: 'Task marked as done!' });
});

// Delete task + file
app.delete('/delete/:id', (req, res) => {
  const task = tasks.find(t => t.id == req.params.id);
  if (task) {
    fs.unlink(task.filePath, err => {
      if (err) console.error("File deletion error:", err);
    });
  }
  tasks = tasks.filter(t => t.id != req.params.id);
  const comments = readComments();
  delete comments[req.params.id];
  writeComments(comments);
  res.json({ message: 'Task and file deleted!' });
});

// ✅ Use Render's dynamic port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
