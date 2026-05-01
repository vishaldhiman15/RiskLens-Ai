const express = require('express');
const router = express.Router();
const Startup = require('../models/Startup');
const auth = require('../middleware/auth');

// Create or Update a startup (for Founder)
router.post('/', auth, async (req, res) => {
  try {
    const { name, industry, stage, description, publicMetrics, confidentialMetrics } = req.body;

    let startup = await Startup.findOne({ founderId: req.user.id });

    if (startup) {
      // Update
      startup.name = name || startup.name;
      startup.industry = industry || startup.industry;
      startup.stage = stage || startup.stage;
      startup.description = description || startup.description;
      if (publicMetrics) startup.publicMetrics = { ...startup.publicMetrics, ...publicMetrics };
      if (confidentialMetrics) startup.confidentialMetrics = { ...startup.confidentialMetrics, ...confidentialMetrics };
      
      await startup.save();
      return res.json(startup);
    }

    // Create
    startup = new Startup({
      founderId: req.user.id,
      name,
      industry,
      stage,
      description,
      publicMetrics,
      confidentialMetrics
    });

    await startup.save();
    res.status(201).json(startup);
  } catch (error) {
    console.error('Startup Create/Update Error:', error);
    res.status(500).json({ error: 'Server error while saving startup data' });
  }
});

// Get founder's own startup (Includes confidential data)
router.get('/mine', auth, async (req, res) => {
  try {
    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({ error: 'No startup found for this user' });
    }
    res.json(startup);
  } catch (error) {
    console.error('Fetch My Startup Error:', error);
    res.status(500).json({ error: 'Server error while fetching your startup' });
  }
});

// Get founder analytics: investor list, total raised, platform stats
router.get('/mine/analytics', auth, async (req, res) => {
  try {
    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({ error: 'No startup found for this user' });
    }

    const User = require('../models/User');
    const startupName = startup.name;

    // Find all investors who invested in this startup by company name
    const investors = await User.find({
      role: 'investor',
      'companyInvestments.companyName': { $regex: new RegExp(startupName, 'i') }
    }).select('name email profileImage companyInvestments createdAt');

    // Build investor rows with their investment amounts
    const investorRows = investors.map(inv => {
      const relevant = inv.companyInvestments.filter(ci =>
        ci.companyName.toLowerCase().includes(startupName.toLowerCase())
      );
      const totalByThisInvestor = relevant.reduce((sum, ci) => sum + (ci.amount || 0), 0);
      const latestDate = relevant.sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date;
      return {
        name: inv.name,
        email: inv.email,
        profileImage: inv.profileImage,
        totalInvested: totalByThisInvestor,
        latestDate,
        rounds: relevant.length
      };
    });

    const totalRaised = investorRows.reduce((sum, r) => sum + r.totalInvested, 0);

    // Platform stats
    const totalInvestorCount = await User.countDocuments({ role: 'investor' });
    const totalFounderCount = await User.countDocuments({ role: 'founder' });
    const totalUsers = await User.countDocuments();

    res.json({
      startup: {
        name: startup.name,
        industry: startup.industry,
        stage: startup.stage,
        description: startup.description,
        confidentialMetrics: startup.confidentialMetrics,
        createdAt: startup.createdAt
      },
      totalRaised,
      investorCount: investorRows.length,
      investors: investorRows,
      platformStats: { totalUsers, totalInvestorCount, totalFounderCount }
    });
  } catch (error) {
    console.error('Founder Analytics Error:', error);
    res.status(500).json({ error: 'Server error while fetching founder analytics' });
  }
});

// Get all startups (For Investors / Public) - Hides confidential data
router.get('/', auth, async (req, res) => {
  try {
    const startups = await Startup.find().select('-confidentialMetrics -__v');
    res.json(startups);
  } catch (error) {
    console.error('Fetch All Startups Error:', error);
    res.status(500).json({ error: 'Server error while fetching startups' });
  }
});

// Get single startup by ID (For detail page) - Hides confidential data
router.get('/:id', auth, async (req, res) => {
  try {
    const startup = await Startup.findById(req.params.id).select('-confidentialMetrics -__v');
    if (!startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }
    res.json(startup);
  } catch (error) {
    console.error('Fetch Startup by ID Error:', error);
    res.status(500).json({ error: 'Server error while fetching startup details' });
  }
});

module.exports = router;
