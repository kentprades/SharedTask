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
app.use('/uploads', express.static(uploadDir));

// In-memory task storage
let tasks = [];

// Upload task
app.post('/upload', upload.single('taskFile'), (req, res) => {
  const task = {
    id: Date.now(),
    description: req.body.description,
    fileName: req.file.originalname,
    filePath: req.file.path,
    status: 'pending',
    sendTo: req.body.sendTo || 'public'   // NEW FIELD
  };
  tasks.push(task);
  res.json({ message: 'Task submitted!' });
});

// Get tasks
app.get('/tasks', (req, res) => {
  res.json(tasks);
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
  res.json({ message: 'Task and file deleted!' });
});

// ✅ Use Render's dynamic port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
