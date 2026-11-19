
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config({ path: './.env' });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174']
}));
app.use(express.json());

let client;
let collection;
let users;
let requests;

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role || 'donor'
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Please login first.'
    });
  }

  try {
    req.user = jwt.verify(
      authHeader.split(' ')[1],
      process.env.JWT_SECRET
    );
    next();
  } catch {
    return res.status(401).json({
      error: 'Invalid or expired token. Please login again.'
    });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({
        error: `Only ${role}s can perform this action.`
      });
    }
    next();
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: collection ? 'mongodb' : 'disconnected'
  });
});

// SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (
      typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || password.length < 8 ||
      !['donor', 'receiver'].includes(role)
    ) {
      return res.status(400).json({
        error: 'Enter your name, email, password (at least 8 characters), and select Donor or Receiver.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await users.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'This email is already registered. Please login.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = {
      name: name.trim().slice(0, 100),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      createdAt: new Date()
    };

    const result = await users.insertOne(user);
    const savedUser = { ...user, _id: result.insertedId };

    res.status(201).json({
      message: 'Signup successful.',
      token: createToken(savedUser),
      user: {
        id: savedUser._id.toString(),
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Could not create account.'
    });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body || {};

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password ||
      !['donor', 'receiver'].includes(role)
    ) {
      return res.status(400).json({
        error: 'Enter your email, password, and select your role.'
      });
    }

    const user = await users.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        error: 'Incorrect email or password.'
      });
    }

    if (!user.role) {
      await users.updateOne(
        { _id: user._id },
        { $set: { role: 'donor' } }
      );
      user.role = 'donor';
    }

    if (user.role !== role) {
      return res.status(403).json({
        error: `This account is registered as ${user.role}. Please choose the correct role.`
      });
    }

    res.json({
      message: 'Login successful.',
      token: createToken(user),
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Could not login.'
    });
  }
});

// VIEW MEDICINES
app.get('/api/medicines', async (_req, res) => {
  try {
    const records = await collection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(records);
  } catch (error) {
    console.error('Load medicines error:', error);
    res.status(500).json({
      error: 'Could not load listings.'
    });
  }
});

// ADD MEDICINE - DONOR ONLY
app.post(
  '/api/medicines',
  authenticateToken,
  requireRole('donor'),
  async (req, res) => {
    try {
      const {
        name,
        quantity,
        expiryDate,
        donor,
        description,
        location
      } = req.body || {};

      if (
        typeof name !== 'string' || !name.trim() ||
        !Number.isInteger(Number(quantity)) ||
        Number(quantity) < 1 ||
        !expiryDate ||
        typeof donor !== 'string' || !donor.trim()
      ) {
        return res.status(400).json({
          error: 'Enter a medicine name, positive quantity, expiry date, and donor.'
        });
      }

      const medicine = {
        name: name.trim().slice(0, 100),
        quantity: Number(quantity),
        expiryDate: String(expiryDate),
        donor: donor.trim().slice(0, 100),
        description: typeof description === 'string'
          ? description.trim().slice(0, 500)
          : '',
        location: typeof location === 'string'
          ? location.trim().slice(0, 150)
          : '',
        createdBy: req.user.id,
        createdAt: new Date()
      };

      const result = await collection.insertOne(medicine);

      res.status(201).json({
        ...medicine,
        _id: result.insertedId
      });
    } catch (error) {
      console.error('Add medicine error:', error);
      res.status(500).json({
        error: 'Could not save listing.'
      });
    }
  }
);

// RECEIVER: REQUEST A MEDICINE
app.post(
  '/api/requests',
  authenticateToken,
  requireRole('receiver'),
  async (req, res) => {
    try {
      const { medicineId, message } = req.body || {};

      if (
        typeof medicineId !== 'string' ||
        !ObjectId.isValid(medicineId)
      ) {
        return res.status(400).json({
          error: 'Please select a valid medicine.'
        });
      }

      const medicine = await collection.findOne({
        _id: new ObjectId(medicineId)
      });

      if (!medicine) {
        return res.status(404).json({
          error: 'Medicine not found.'
        });
      }

      if (medicine.createdBy === req.user.id) {
        return res.status(403).json({
          error: 'You cannot request your own medicine.'
        });
      }

      if (medicine.expiryDate &&
          new Date(medicine.expiryDate) < new Date()) {
        return res.status(400).json({
          error: 'This medicine has expired and cannot be requested.'
        });
      }

      const existingRequest = await requests.findOne({
        medicineId: medicine._id,
        receiverId: req.user.id,
        status: { $in: ['pending', 'accepted'] }
      });

      if (existingRequest) {
        return res.status(409).json({
          error: 'You already have an active request for this medicine.'
        });
      }

      const request = {
        medicineId: medicine._id,
        medicineName: medicine.name,
        donorId: medicine.createdBy,
        donorName: medicine.donor,
        receiverId: req.user.id,
        receiverEmail: req.user.email,
        message: typeof message === 'string'
          ? message.trim().slice(0, 500)
          : '',
        status: 'pending',
        createdAt: new Date()
      };

      const result = await requests.insertOne(request);

      res.status(201).json({
        message: 'Medicine request submitted successfully.',
        request: {
          ...request,
          _id: result.insertedId
        }
      });
    } catch (error) {
      console.error('Create request error:', error);
      res.status(500).json({
        error: 'Could not submit medicine request.'
      });
    }
  }
);

// RECEIVER: VIEW OWN REQUESTS
app.get(
  '/api/requests/my',
  authenticateToken,
  requireRole('receiver'),
  async (req, res) => {
    try {
      const records = await requests
        .find({ receiverId: req.user.id })
        .sort({ createdAt: -1 })
        .toArray();

      res.json(records);
    } catch (error) {
      console.error('Load receiver requests error:', error);
      res.status(500).json({
        error: 'Could not load your requests.'
      });
    }
  }
);

// DONOR: VIEW REQUESTS FOR OWN MEDICINES
app.get(
  '/api/requests/donor',
  authenticateToken,
  requireRole('donor'),
  async (req, res) => {
    try {
      const records = await requests
        .find({ donorId: req.user.id })
        .sort({ createdAt: -1 })
        .toArray();

      res.json(records);
    } catch (error) {
      console.error('Load donor requests error:', error);
      res.status(500).json({
        error: 'Could not load medicine requests.'
      });
    }
  }
);

// DONOR: ACCEPT OR REJECT REQUEST
app.patch(
  '/api/requests/:id/status',
  authenticateToken,
  requireRole('donor'),
  async (req, res) => {
    try {
      const { status } = req.body || {};
      const requestId = req.params.id;

      if (!ObjectId.isValid(requestId)) {
        return res.status(400).json({
          error: 'Invalid request ID.'
        });
      }

      if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({
          error: 'Status must be accepted or rejected.'
        });
      }

      const request = await requests.findOne({
        _id: new ObjectId(requestId)
      });

      if (!request) {
        return res.status(404).json({
          error: 'Request not found.'
        });
      }

      if (request.donorId !== req.user.id) {
        return res.status(403).json({
          error: 'You can only manage requests for your own medicines.'
        });
      }

      if (request.status !== 'pending') {
        return res.status(409).json({
          error: 'This request has already been processed.'
        });
      }

      await requests.updateOne(
        { _id: request._id, status: 'pending' },
        {
          $set: {
            status,
            updatedAt: new Date()
          }
        }
      );

      res.json({
        message: `Request ${status} successfully.`,
        status
      });
    } catch (error) {
      console.error('Update request error:', error);
      res.status(500).json({
        error: 'Could not update request status.'
      });
    }
  }
);

async function startServer() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    throw new Error('MONGODB_URI and JWT_SECRET must be set in .env');
  }

  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  const database = client.db(process.env.MONGODB_DB || 'medishare');

  collection = database.collection('medicines');
  users = database.collection('users');
  requests = database.collection('medicine_requests');

  await users.createIndex({ email: 1 }, { unique: true });

  console.log('Connected to MongoDB.');

  app.listen(port, () => {
    console.log(`MediShare API running at http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  if (client) await client.close();
  process.exit(0);
});
