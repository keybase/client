// @flow
import {trim} from 'lodash-es'

function isBlank(s: string): boolean {
  return trim(s).length === 0
}

function hasSpaces(s: string): boolean {
  return s.indexOf(' ') !== -1
}

function hasPeriod(s: string): boolean {
  return s.indexOf('.') !== -1
}

function hasAtSign(s: string): boolean {
  return s.indexOf('@') !== -1
}

function isEmptyOrBlank(thing: ?string): boolean {
  if (!thing || isBlank(thing)) {
    return true
  }
  return false
}

// Returns an error string if not valid
function isValidCommon(thing: ?string): ?Error {
  if (isEmptyOrBlank(thing)) return new Error('Cannot be blank')
  if (thing && hasSpaces(thing)) return new Error('No spaces allowed')
}

// Returns an error string if not valid
function isValidUsername(username: ?string): ?Error {
  const commonError = isValidCommon(username)
  if (commonError) {
    return commonError
  }
  if (username && hasPeriod(username)) {
    return new Error("Usernames can't contain periods.")
  }
}

// Returns an error if not valid
function isValidEmail(email: ?string): ?Error {
  const commonError = isValidCommon(email)
  if (commonError) {
    return commonError
  }

  if (email && !hasAtSign(email)) {
    return new Error('Invalid email address.')
  }

  if (email && email.length >= 128) {
    return new Error('Email address is too long.')
  }
}

// Returns an error string if not valid
function isValidName(name: ?string): ?Error {
  if (isEmptyOrBlank(name)) return new Error('Please provide your name.')
}

export {isValidUsername, isValidEmail, isValidName}
