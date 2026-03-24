const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');
const { getDbConnection } = require('./config/db');
const { verifyToken, verifyAdmin } = require('./middleware/auth');
const { DefaultAzureCredential } = require('@azure/identity');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Security & middleware
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Multer for profile photo (memory storage → stream to Blob)
const upload = multer({ storage: multer.memoryStorage() });

// Azure Blob client (user-assigned MI)
const blobServiceClient = new BlobServiceClient(
  `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
  process.env.AZURE_CLIENT_ID
    ? new DefaultAzureCredential({ managedIdentityClientId: process.env.AZURE_CLIENT_ID })
    : new DefaultAzureCredential()
);
const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_BLOB_CONTAINER_NAME);

// Routes
app.get('/', (req, res) => {
  res.render('home', { user: req.cookies.authToken ? jwt.decode(req.cookies.authToken) : null });
});

app.get('/register', (req, res) => res.render('register', { recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY, errors: [] }));

app.post('/register',
  upload.single('profile_photo'),
  body('email').isEmail(),
  body('first_name').notEmpty(),
  body('last_name').notEmpty(),
  body('date_of_birth').isDate(),
  body('mailing_address').optional(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.render('register', { recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY, errors: errors.array() });

    // reCAPTCHA v2 verification
    const recaptchaResponse = req.body['g-recaptcha-response'];
    const verify = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaResponse}`);
    if (!verify.data.success) return res.status(400).send('CAPTCHA failed');

    const { email, password, first_name, last_name, date_of_birth, mailing_address } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);

    let photoUrl = null;
    if (req.file) {
      const blobName = `profile-${Date.now()}-${req.file.originalname}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.uploadData(req.file.buffer, { blobHTTPHeaders: { blobContentType: req.file.mimetype } });
      photoUrl = `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${process.env.AZURE_BLOB_CONTAINER_NAME}/${blobName}`;
    }

    const conn = await getDbConnection();
    await conn.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, mailing_address, profile_photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, first_name, last_name, date_of_birth, mailing_address || null, photoUrl]
    );
    await conn.end();

    res.redirect('/login');
  }
);

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const conn = await getDbConnection();
  const [rows] = await conn.execute('SELECT * FROM users WHERE email = ?', [email]);
  await conn.end();

  if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.render('login', { error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: rows[0].id, email: rows[0].email, is_admin: rows[0].is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.cookie('authToken', token, { httpOnly: true, secure: true, sameSite: 'strict' });
  res.redirect(rows[0].is_admin ? '/admin' : '/');
});

app.get('/logout', (req, res) => {
  res.clearCookie('authToken');
  res.redirect('/');
});

// Admin – protected
app.get('/admin', verifyToken, verifyAdmin, async (req, res) => {
  const conn = await getDbConnection();
  const [users] = await conn.execute('SELECT id, email, first_name, last_name, date_of_birth, mailing_address, is_admin, profile_photo_url FROM users');
  await conn.end();
  res.render('admin', { users, user: req.user });
});

app.post('/admin/edit/:id', verifyToken, verifyAdmin, upload.single('profile_photo'), async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, date_of_birth, mailing_address, is_admin } = req.body;
  let photoUrl = req.body.existing_photo;

  if (req.file) {
    const blobName = `profile-${Date.now()}-${req.file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(req.file.buffer);
    photoUrl = `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${process.env.AZURE_BLOB_CONTAINER_NAME}/${blobName}`;
  }

  const conn = await getDbConnection();
  await conn.execute(
    `UPDATE users SET first_name=?, last_name=?, date_of_birth=?, mailing_address=?, is_admin=?, profile_photo_url=?
     WHERE id=?`,
    [first_name, last_name, date_of_birth, mailing_address || null, is_admin === 'on', photoUrl, id]
  );
  await conn.end();
  res.redirect('/admin');
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} – ready for Azure App Service`);
});