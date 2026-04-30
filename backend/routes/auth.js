const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
require('dotenv').config({ path: __dirname + '/../.env' });

router.post('/signup', upload.single('profileImage'), async (req, res) => {
  try {
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured in environment variables');
      return res.status(500).json({ error: 'Server configuration error: JWT_SECRET not set' });
    }

    const { name, email, password, role, startupName, investmentBudget, industry, stage } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    let userRole = 'user';
    if (['founder', 'investor'].includes(role)) {
      userRole = role;
    }

    const user = new User({
      name,
      email,
      password: hashedPassword,
      profileImage: req.file ? req.file.path : '',
      role: userRole,
      ...(userRole === 'founder' && { startupName, industry, stage }),
      ...(userRole === 'investor' && { investmentBudget })
    });

    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, profileImage: user.profileImage, role: user.role }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

router.post('/login', async (req, res) => {
  try {
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured in environment variables');
      return res.status(500).json({ error: 'Server configuration error: JWT_SECRET not set' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, profileImage: user.profileImage, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/profile', auth, upload.single('profileImage'), async (req, res) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.startupName) updates.startupName = req.body.startupName;
    if (req.body.investmentBudget) updates.investmentBudget = req.body.investmentBudget;
    if (req.body.industry) updates.industry = req.body.industry;
    if (req.body.stage) updates.stage = req.body.stage;
    if (req.file) updates.profileImage = req.file.path;

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/startups', auth, async (req, res) => {
  try {
    const founders = await User.find({ role: 'founder' }).select('name email startupName industry stage profileImage');
    res.json(founders);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching startups' });
  }
});

router.post('/investments', auth, async (req, res) => {
  try {
    const { companyName, amount } = req.body;
    if (!companyName || !amount) {
      return res.status(400).json({ error: 'Company name and amount are required' });
    }
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'investor') {
      return res.status(403).json({ error: 'Only investors can add investments' });
    }
    user.companyInvestments.push({ companyName, amount });
    await user.save();
    res.json(user.companyInvestments);
  } catch (error) {
    res.status(500).json({ error: 'Server error adding investment' });
  }
});

module.exports = router;
