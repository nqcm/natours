const express = require('express')
const authController = require('./../controllers/authController')
const tourController = require('./../controllers/tourController')
const reviewRouter = require('./../routes/reviewRoutes')

const router = express.Router()

// router.param('id', tourController.checkID)

router.use('/:tourId/reviews', reviewRouter)

router
  .route('/favorite-tours')
  .get(tourController.aliasFavTours, tourController.getAllTours)

router.route('/tour-stats').get(tourController.getTourStats)
router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan
  )

router.route('/tours-within/:distance/center/:latlng/unit/:unit').get(tourController.getToursWithin)

router.route('/distances/:latlng/unit/:unit').get(tourController.getDistances)

router
  .route('/')
  .get(tourController.getAllTours)
  .post(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.createTour
  )
router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.uploadTourImages,
    tourController.resizeTourImages,
    tourController.updateTour
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour
  )

module.exports = router