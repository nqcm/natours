const jwt = require('jsonwebtoken')
const { promisify } = require('util')
const AppError = require('./../utils/appError')
const Email = require('./../utils/email')
const User = require('./../models/userModel')
const catchAsync = require('./../utils/catchAsync')
const crypto = require('crypto')

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  })
}

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id)

  res.cookie('jwt', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  })

  // REMOVE PASSWORD FROM OUTPUT
  user.password = undefined

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  })
}

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role
  })

  const url = `${req.protocol}://${req.get('host')}/me`
  await new Email(newUser, url).sendWelcome()
  createSendToken(newUser, 201, req, res)
})

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body

  // Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400))
  }
  // check if password is correct
  const user = await User.findOne({ email }).select('+password')
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401))
  }
  // Send token
  createSendToken(user, 200, req, res)
})

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() * 10 * 1000),
    httpOnly: true
  })
  res.status(200).json({ status: 'success' })
}

exports.protect = catchAsync(async (req, res, next) => {
  let token
  // 1) GETTING TOKEN FROM REQUEST
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1]
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to access.', 401)
    )
  }
  // 2) VERIFICATION
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)

  // 3) CHECK IF USER STILL EXISTS
  const currentUser = await User.findById(decoded.id)
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    )
  }

  // 4) CHECK IF PASSWORD HAS BEEN CHANGED AFTER THE TOKEN WAS ISSUED.
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password!. Please log in again.', 401)
    )
  }
  req.user = currentUser
  res.locals.user = currentUser
  next()
})

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      )
    }
    next()
  }
}

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) GET USER BASED ON POSTed EMAIL
  const user = await User.findOne({ email: req.body.email })
  if (!user) {
    return next(new AppError('There is no user with this email address.', 404))
  }

  // 2) GENERATE THE RANDOM RESET TOKEN
  const resetToken = user.createPasswordResetToken()
  await user.save({ validateBeforeSave: false })

  // 3) SEND IT TO USER'S EMAIL

  // const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to ${resetURL}\nIf you didn't submit this request, please ignore this email.`

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`
    await new Email(user, resetURL).sendPasswordReset()
    res.status(200).json({
      status: 'success',
      message: 'Password reset token sent via email'
    })
  } catch (err) {
    user.passwordResetToken = undefined
    user.passwordResetExpired = undefined
    await user.save({ validateBeforeSave: false })

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    )
  }
})

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) GET USER BASED ON THE TOKEN
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex')
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  })

  // 2) IF TOKEN HAS NOT EXPIRED AND THERE IS A USER, SET THE NEW PASSWORD
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400))
  }
  user.password = req.body.password
  user.passwordConfirm = req.body.passwordConfirm
  user.passwordResetToken = undefined
  user.passwordResetExpires = undefined
  await user.save()

  // 3) UPDATE ChangedPasswordAt PROPERTY - Done in usermodel
  // 4) LOG THE USER IN, SEND JWT
  createSendToken(user, 200, req, res)
})

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) GET USER FROM COLLECTION
  const user = await User.findById(req.user.id).select('+password')

  // 2) CHECK IF POSTed CURRENT PASSWORD IS CORRECT
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong!', 401))
  }

  // 3) IF SO, UPDATE PASSWORD
  user.password = req.body.password
  user.passwordConfirm = req.body.passwordConfirm
  await user.save()

  // 4) LOG USER IN, SEND JWT
  createSendToken(user, 200, req, res)
})

// Only for rendered pages, no errors
exports.isLoggedIn = async (req, res, next) => {
  try {
    if (req.cookies.jwt) {
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      )
      const currentUser = await User.findById(decoded.id)
      if (!currentUser) {
        return next()
      }

      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next()
      }

      res.locals.user = currentUser
      return next()
    }
  } catch (err) {
    return next()
  }
  next()
}
