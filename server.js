const express = require('express');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ========== Setup ==========
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'devdrop_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));

app.set('view engine', 'ejs');

const uploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

// ========== Load JSON Files ==========
const USERS_PATH = 'users.json';
const FILES_PATH = 'files.json';

let users = fs.existsSync(USERS_PATH)
  ? JSON.parse(fs.readFileSync(USERS_PATH))
  : [];

function loadFiles() {
  return fs.existsSync(FILES_PATH)
    ? JSON.parse(fs.readFileSync(FILES_PATH))
    : [];
}

// ========== Auth Middleware ==========
function checkAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login.html');
}

// ========== Multer Setup ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${req.session.user}-${file.originalname}`)
});
const upload = multer({ storage });

// ========== Routes ==========

// Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.send("⚠️ User already exists.");
  }
  const hashed = await bcrypt.hash(password, 10);
  users.push({ username, password: hashed });
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
  res.redirect('/login.html');
});

// Login
app.post('/login', async (req, res) => {
  const user = users.find(u => u.username === req.body.username);
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.send("❌ Invalid credentials");
  }
  req.session.user = user.username;
  res.redirect('/dashboard');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

// Upload File
app.post('/upload', checkAuth, upload.single('devfile'), (req, res) => {
  const db = loadFiles();
  db.push({ filename: req.file.filename, owner: req.session.user });
  fs.writeFileSync(FILES_PATH, JSON.stringify(db, null, 2));
  res.redirect('/dashboard');
});

// Dashboard
app.get('/dashboard', checkAuth, (req, res) => {
  const db = loadFiles();
  const userFiles = db.filter(f => f.owner === req.session.user);
  res.render('dashboard', { user: req.session.user, files: userFiles });
});

// Delete File
app.post('/delete/:filename', checkAuth, (req, res) => {
  const db = loadFiles();
  const file = db.find(f => f.filename === req.params.filename);
  if (file && file.owner === req.session.user) {
    fs.unlinkSync(`uploads/${file.filename}`);
    const updated = db.filter(f => f.filename !== req.params.filename);
    fs.writeFileSync(FILES_PATH, JSON.stringify(updated, null, 2));
    return res.redirect('/dashboard');
  }
  res.status(403).send("⛔ Unauthorized or file not found.");
});

// Public API for All Files
app.get('/files', (req, res) => {
  const db = loadFiles();
  res.json(db);
});

// Preview File
app.get('/preview/:filename', checkAuth, (req, res) => {
  const filepath = path.join(__dirname, 'uploads', req.params.filename);
  const ext = path.extname(filepath);
  const previewable = ['.txt', '.js', '.py', '.json'];

  if (!fs.existsSync(filepath)) {
    return res.status(404).send("File not found.");
  }

  if (!previewable.includes(ext)) {
    return res.send("⚠️ Preview not available for this file type.");
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  res.render('preview', { filename: req.params.filename, content });
});

// ========== Start Server ==========
app.listen(PORT, () =>
  console.log(`🚀 DevDrop HQ running at http://localhost:${PORT}`)
);
const uploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);
        
