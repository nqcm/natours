const path = require('path')
const express = require('express')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const mongoSanitize = require('express-mongo-sanitize')
const xss = require('xss-clean')
const hpp = require('hpp')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const compression = require('compression')
const AppError = require('./utils/appError')
const globalErrorHandler = require('./controllers/errorController')
const tourRouter = require('./routes/tourRoutes')
const userRouter = require('./routes/userRoutes')
const reviewRouter = require('./routes/reviewRoutes')
const viewsRouter = require('./routes/viewsRoutes')
const bookingRouter = require('./routes/bookingRoutes')


// START EXPRESS APP
const app = express()

app.enable('trust proxy')

app.set('view engine', 'pug')
app.set('views', path.join(__dirname, 'views'))

// GLOBAL MIDDLEWARES

// SERVING STATIC FILES
app.use(express.static(path.join(__dirname, 'public')))

app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
)

// SET SECURITY HTTP HEADERS
// app.use(helmet())

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'", 'https:', 'http:', 'data:', 'ws:'],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'http:', 'data:'],
      scriptSrc: ["'self'", 'https:', 'http:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:', 'http:'],
    },
  })
)

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

// LIMIT REQUESTS FROM SAME IP
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour'
})
app.use('/api', limiter)

// BODY PARSER, READING DATA FROM BODY INTO REQ.BODY
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb'}))
app.use(cookieParser())

// DATA SANITISATION AGAINST NoSQL QUERY INJECTION
app.use(mongoSanitize())

// DATA SANITISATION AGAINST XSS
app.use(xss())

// PREVENT PARAMETER POLLUTION
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price'
    ]
  })
)

app.use(compression())

// TEST MIDDLEWARE
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString()
  next()
})

// ROUTES

app.use('/', viewsRouter)
app.use('/api/v1/tours', tourRouter)
app.use('/api/v1/users', userRouter)
app.use('/api/v1/reviews', reviewRouter)
app.use('/api/v1/bookings', bookingRouter)



app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404))
})

app.use(globalErrorHandler)

module.exports = app
