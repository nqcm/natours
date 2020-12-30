import axios from "axios"
import { showAlert } from './alerts'
const stripe = Stripe('pk_test_51I3KpNI2cruihwOQhWWbQtXziCJrIe2E626TWMlbvYeDBJV56V2gOCwWPzkEwPHoxgiD8qMftM0pgfMao3EYgzIr00NXq6J5pM')

export const bookTour = async tourId => {
  
  try {
    // 1) GET CHECKOUT SESSION FROM THE ENDPOINT
  const session = await axios(
    `/api/v1/bookings/checkout-session/${tourId}/`
  )
  console.log(session)

  // 2) CREATE CHECKOUT FORM + CHARGE CREDIT CARD
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id
    })

  } catch (err) {
    console.log(err)
    showAlert('error', err)
  }
}