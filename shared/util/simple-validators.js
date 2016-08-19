// @flow
import _ from 'lodash'

function isBlank (s: string): boolean {
  return _.trim(s).length === 0
}

function hasSpaces (s: string): boolean {
  return s.indexOf(' ') !== -1
}

function hasAtSign (s: string): boolean {
  return s.indexOf('@') !== -1
}

function isEmptyOrBlank (thing: ?string): boolean {
  if (!thing || isBlank(thing)) {
    return true
  }
  return false
}

// Returns an error string if not valid
function isValidCommon (thing: ?string): ?string {
  if (isEmptyOrBlank(thing)) return 'Cannot be blank'
  if (thing && hasSpaces(thing)) return 'No spaces allowed'
}

// Returns an error string if not valid
function isValidUsername (username: ?string): ?string {
  const commonError = isValidCommon(username)
  if (commonError) {
    return commonError
  }
}

// Returns an error string if not valid
function isValidEmail (email: ?string): ?string {
  const commonError = isValidCommon(email)
  if (commonError) {
    return commonError
  }

  if (email && !hasAtSign(email)) {
    return 'Invalid email address.'
  }
}

// Returns an error string if not valid
function isValidName (name: ?string): ?string {
  if (isEmptyOrBlank(name)) return 'Please provide your name.'
}

export {
  isValidUsername,
  isValidEmail,
  isValidName,
}
