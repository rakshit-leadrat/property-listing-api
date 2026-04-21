const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - listedBy
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               listedBy:
 *                 type: string
 *                 enum: [builder, owner, agent]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */
// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, listedBy } = req.body;

        const validRoles = {
            'builder': 'Builder',
            'owner': 'Owner',
            'agent': 'Agent'
        };
        const normalizedRole = validRoles[listedBy.toLowerCase()];

        // Validate listedBy
        /*if (!['Builder', 'Owner', 'Agent'].includes(listedBy)) {
            return res.status(400).json({ message: 'Invalid user role' });
        }*/
        if (!normalizedRole) {
            return res.status(400).json({ message: 'Invalid user role' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user
        /* const user = new User({ email, password, listedBy }); */
        const user = new User({ 
            email, 
            password, 
            listedBy: normalizedRole
        });
        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({ user, token });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ user, token });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get current user
router.get('/me', auth, (req, res) => {
    res.json(req.user);
});

// Logout user
router.post('/logout', auth, (req, res) => {
    res.json({ message: 'Successfully logged out.' });
});

module.exports = router; 