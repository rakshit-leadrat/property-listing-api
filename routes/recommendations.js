const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Property = require('../models/Property');
const Recommendation = require('../models/Recommendation');
const auth = require('../middleware/auth');
const redisClient = require('../utils/redis');
const pagination = require('../middleware/pagination');

/**
 * @openapi
 * /api/recommendations/received:
 *   get:
 *     tags:
 *       - Recommendations
 *     summary: Get recommendations received by current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of received recommendations with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 * /api/recommendations/send:
 *   post:
 *     tags:
 *       - Recommendations
 *     summary: Send property recommendation
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               propertyId:
 *                 type: string
 *               toUserId:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Recommendation sent
 */
// Search for users by email
router.get('/search-users', auth, pagination, async (req, res) => {
    try {
        const { email, page, limit } = req.query;
        const skip = (page - 1) * limit;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Search for users by email (excluding current user)
        const [users, total] = await Promise.all([
            User.find({
                email: { $regex: email, $options: 'i' },
                _id: { $ne: req.user._id }
            })
            .select('email listedBy')
            .skip(skip)
            .limit(limit),
            User.countDocuments({
                email: { $regex: email, $options: 'i' },
                _id: { $ne: req.user._id }
            })
        ]);

        res.json({
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Send property recommendation
router.post('/send', auth, async (req, res) => {
    try {
        const { propertyId, toUserId, message } = req.body;

        // Validate property exists
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        // Validate recipient exists
        const recipient = await User.findById(toUserId);
        if (!recipient) {
            return res.status(404).json({ message: 'Recipient not found' });
        }

        // Create recommendation
        const recommendation = new Recommendation({
            property: propertyId,
            fromUser: req.user._id,
            toUser: toUserId,
            message
        });

        await recommendation.save();
        // Invalidate cache for received recommendations of the recipient
        await redisClient.del(`recommendations:received:${toUserId}`);

        res.status(201).json(recommendation);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get recommendations received by current user
router.get('/received', auth, pagination, async (req, res) => {
    try {
        const { page, limit } = req.query;
        const skip = (page - 1) * limit;
        const cacheKey = `recommendations:received:${req.user._id}:${page}:${limit}`;

        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        // Fetch recommendations from the database with pagination
        const [recommendations, total] = await Promise.all([
            Recommendation.find({ toUser: req.user._id })
                .populate('fromUser', 'email listedBy')
                .populate('property')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Recommendation.countDocuments({ toUser: req.user._id })
        ]);

        const result = {
            recommendations,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };

        // Cache the result with a 5-minute expiration    
        await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get recommendations sent by current user
router.get('/sent', auth, pagination, async (req, res) => {
    try {
        const { page, limit } = req.query;
        const skip = (page - 1) * limit;

        const [recommendations, total] = await Promise.all([
            Recommendation.find({ fromUser: req.user._id })
                .populate('toUser', 'email listedBy')
                .populate('property')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Recommendation.countDocuments({ fromUser: req.user._id })
        ]);

        const result = {
            recommendations,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark recommendation as read
router.patch('/:id/read', auth, async (req, res) => {
    try {
        const recommendation = await Recommendation.findOne({
            _id: req.params.id,
            toUser: req.user._id
        });

        if (!recommendation) {
            return res.status(404).json({ message: 'Recommendation not found' });
        }

        recommendation.isRead = true;
        await recommendation.save();
        await redisClient.del(`recommendations:received:${req.user._id}`);
        res.json(recommendation);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete recommendation
router.delete('/:id', auth, async (req, res) => {
    try {
        const recommendation = await Recommendation.findOne({
            _id: req.params.id,
            $or: [
                { fromUser: req.user._id },
                { toUser: req.user._id }
            ]
        });

        if (!recommendation) {
            return res.status(404).json({ message: 'Recommendation not found' });
        }

        await recommendation.deleteOne();
        res.json({ message: 'Recommendation deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 