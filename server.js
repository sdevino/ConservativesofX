require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const app = express();
const prisma = new PrismaClient();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

require('./config/passport')(passport, prisma);

app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// Middleware
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
};

const ensureAdmin = (req, res, next) => {
  if (req.user?.isAdmin) return next();
  res.status(403).send('Access denied');
};

// Routes
app.get('/', (req, res) => res.render('index'));

app.get('/about', (req, res) => res.render('about'));

app.get('/events', async (req, res) => {
  const events = await prisma.event.findMany({
    orderBy: { dateTime: 'asc' },
    take: 30
  });
  res.render('events', { events });
});

app.get('/community', ensureAuthenticated, async (req, res) => {
  const categories = await prisma.forumCategory.findMany({
    include: {
      posts: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { author: true }
      }
    }
  });
  res.render('community', { categories });
});

app.get('/donate', (req, res) => res.render('donate'));

app.get('/contact', (req, res) => res.render('contact'));

// Auth
app.get('/signup', (req, res) => res.render('signup'));
app.post('/signup', async (req, res) => {
  const {
    firstName, lastName, email, phone, password,
    dateOfBirth, emailOptIn, smsOptIn
  } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).send('Password must be at least 8 characters');
  }

  try {
    const hashed = await require('bcryptjs').hash(password, 12);
    await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        password: hashed,
        emailOptIn: !!emailOptIn,
        smsOptIn: !!smsOptIn
      }
    });
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.status(400).send('Error – email may already exist');
  }
});

app.get('/login', (req, res) => res.render('login'));

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login?error=1'
}));

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) console.error(err);
    res.redirect('/');
  });
});

// Google OAuth
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

// Profile
app.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', { user: req.user });
});

app.post('/profile', ensureAuthenticated, async (req, res) => {
  const { firstName, lastName, phone, address, emailOptIn, smsOptIn } = req.body;
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      firstName,
      lastName,
      phone,
      address,
      emailOptIn: !!emailOptIn,
      smsOptIn: !!smsOptIn
    }
  });
  res.redirect('/profile');
});

// Admin area
app.get('/admin', ensureAdmin, async (req, res) => {
  const [users, events, categories] = await Promise.all([
    prisma.user.findMany(),
    prisma.event.findMany(),
    prisma.forumCategory.findMany()
  ]);
  res.render('admin', { users, events, categories });
});

// Basic admin actions (expand later)
app.post('/admin/event', ensureAdmin, async (req, res) => {
  const { title, description, dateTime, graphicUrl } = req.body;
  await prisma.event.create({
    data: {
      title,
      description,
      dateTime: new Date(dateTime),
      graphicUrl,
      createdById: req.user.id
    }
  });
  res.redirect('/admin');
});

app.post('/admin/category', ensureAdmin, async (req, res) => {
  await prisma.forumCategory.create({
    data: { name: req.body.name, description: req.body.description }
  });
  res.redirect('/admin');
});

app.post('/community/post', ensureAuthenticated, async (req, res) => {
  const { title, content, categoryId } = req.body;
  await prisma.post.create({
    data: {
      title: title || null,
      content,
      authorId: req.user.id,
      categoryId: Number(categoryId)
    }
  });
  res.redirect('/community');
});

// Catch-all 404 handler – must be last route
app.use((req, res) => {
  res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});