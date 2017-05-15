// @flow
import _ from 'lodash'
import {ValidationError} from './errors'

function isBlank(s: string): boolean {
  return _.trim(s).length === 0
}

function hasSpaces(s: string): boolean {
  return s.indexOf(' ') !== -1
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
  if (isEmptyOrBlank(thing)) return new ValidationError('Cannot be blank')
  if (thing && hasSpaces(thing)) return new ValidationError('No spaces allowed')
}

// Returns an error string if not valid
function isValidUsername(username: ?string): ?Error {
  const commonError = isValidCommon(username)
  if (commonError) {
    return commonError
  }
}

// Returns an error if not valid
function isValidEmail(email: ?string): ?Error {
  const commonError = isValidCommon(email)
  if (commonError) {
    return commonError
  }

  if (email && !hasAtSign(email)) {
    return new ValidationError('Invalid email address.')
  }
}

// Returns an error string if not valid
function isValidName(name: ?string): ?Error {
  if (isEmptyOrBlank(name)) return new ValidationError('Please provide your name.')
}

export {isValidUsername, isValidEmail, isValidName}
