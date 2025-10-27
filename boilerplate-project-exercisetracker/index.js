const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }
})

const User = mongoose.model('User', userSchema)

// Exercise Schema
const exerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
})

const Exercise = mongoose.model('Exercise', exerciseSchema)

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

// POST /api/users - Create a new user
app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' })
    }
    
    // Check if username already exists
    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return res.json({
        username: existingUser.username,
        _id: existingUser._id
      })
    }
    
    const newUser = new User({ username })
    await newUser.save()
    
    res.json({
      username: newUser.username,
      _id: newUser._id
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/users - Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id')
    res.json(users)
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/users/:_id/exercises - Add exercise for a user
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const userId = req.params._id
    let { description, duration, date } = req.body
    
    // Find user
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Validate required fields
    if (!description || !duration) {
      return res.status(400).json({ error: 'Description and duration are required' })
    }
    
    // Parse duration to number
    const durationNum = parseInt(duration)
    if (isNaN(durationNum)) {
      return res.status(400).json({ error: 'Duration must be a number' })
    }
    
    // Parse date or use current date
    let exerciseDate
    if (date) {
      exerciseDate = new Date(date)
      if (isNaN(exerciseDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' })
      }
    } else {
      exerciseDate = new Date()
    }
    
    // Create exercise
    const exercise = new Exercise({
      userId: user._id,
      description,
      duration: durationNum,
      date: exerciseDate
    })
    
    await exercise.save()
    
    // Return user object with exercise fields
    res.json({
      _id: user._id,
      username: user.username,
      date: exercise.date.toDateString(),
      duration: exercise.duration,
      description: exercise.description
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/users/:_id/logs - Get exercise log for a user
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const userId = req.params._id
    const { from, to, limit } = req.query
    
    // Find user
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Build query
    let query = { userId: user._id }
    
    // Add date range filters
    if (from || to) {
      query.date = {}
      if (from) {
        const fromDate = new Date(from)
        if (!isNaN(fromDate.getTime())) {
          query.date.$gte = fromDate
        }
      }
      if (to) {
        const toDate = new Date(to)
        if (!isNaN(toDate.getTime())) {
          query.date.$lte = toDate
        }
      }
    }
    
    // Build find operation
    let findOperation = Exercise.find(query)
      .select('description duration date -_id')
    
    // Apply limit
    if (limit) {
      const limitNum = parseInt(limit)
      if (!isNaN(limitNum)) {
        findOperation = findOperation.limit(limitNum)
      }
    }
    
    // Sort by date (newest first)
    findOperation = findOperation.sort({ date: -1 })
    
    const exercises = await findOperation.exec()
    
    // Format exercises for response
    const log = exercises.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString()
    }))
    
    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log: log
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})