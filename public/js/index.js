import '@babel/polyfill'
import { displayMap } from './mapbox'
import { login, logout } from './login'
import { updateSettings } from './updateSettings'
import { bookTour } from './stripe'
import { showAlert } from './alerts'

// DOM ELEMENTS
const mapBox = document.getElementById('map')
const loginForm = document.querySelector('.login-form')
const logOutButton = document.querySelector('.nav__el--logout')
const userDataForm = document.querySelector('.form-user-data')
const passwordForm = document.querySelector('.form-user-password')
const bookBtn = document.getElementById('book-tour')

// VALUES

// DELEGATION
if (mapBox) {
  const locations = JSON.parse(mapBox.dataset.locations)
  displayMap(locations)
}

if (loginForm) {
  loginForm.addEventListener('submit', e => {
    e.preventDefault()
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    login(email, password)
  })
}

if (logOutButton) {
  logOutButton.addEventListener('click', logout)
}

if (userDataForm) {
  userDataForm.addEventListener('submit', e => {
    e.preventDefault()
    const form = new FormData()
    form.append('name', document.getElementById('name').value)
    form.append('email', document.getElementById('email').value)
    form.append('photo', document.getElementById('photo').files[0])
    updateSettings(form, 'data')
  })
}

if (passwordForm) {
  passwordForm.addEventListener('submit', async e => {
    e.preventDefault()
    document.getElementById('btn-save-password').textContent = 'Updating...'

    const passwordCurrent = document.getElementById('password-current').value
    const password = document.getElementById('password').value
    const passwordConfirm = document.getElementById('password-confirm').value

    await updateSettings(
      { passwordCurrent, password, passwordConfirm },
      'password'
    )
    document.getElementById('btn-save-password').textContent = 'Save password'

    document.getElementById('password-current').value = ''
    document.getElementById('password').value = ''
    document.getElementById('password-confirm').value = ''
  })
}

if (bookBtn) {
  bookBtn.addEventListener('click', e => {
    e.target.textContent = 'Processing...'
    const { tourId } = e.target.dataset
    bookTour(tourId)
  })
}

const alertMessage = document.querySelector('body').dataset.alert
if (alert) showAlert('success', alertMessage, 20)
