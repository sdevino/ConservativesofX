require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

const app = express();

// Prisma with global singleton + debug
let prisma;
if (!global.prisma) {
  global.prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error']
  });
}
prisma = global.prisma;

console.log('Prisma client initialized with DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.use(expressLayouts);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true }
}));

app.use(passport.initialize());
app.use(passport.session());

require('./config/passport')(passport, prisma);

app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// Middleware
const ensureAuthenticated = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/login');
const ensureAdmin = (req, res, next) => req.user?.isAdmin ? next() : res.status(403).render('404');

// Routes
app.get('/', (req, res) => res.render('index'));
app.get('/about', (req, res) => res.render('about'));

app.get('/events', async (req, res) => {
  try {
    const events = await prisma.event.findMany({ orderBy: { dateTime: 'asc' }, take: 30 });
    res.render('events', { events });
  } catch (err) {
    console.error('Events error:', err.message);
    res.status(500).send('Database temporarily unavailable');
  }
});

app.get('/community', ensureAuthenticated, (req, res) => res.render('community'));
app.get('/donate', (req, res) => res.render('donate'));
app.get('/contact', (req, res) => res.render('contact'));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/login', (req, res) => res.render('login'));
app.get('/profile', ensureAuthenticated, (req, res) => res.render('profile', { user: req.user }));

// 404
app.use((req, res) => res.status(404).render('404'));

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});