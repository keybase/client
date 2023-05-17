import trim from 'lodash/trim'

function isBlank(s: string): boolean {
  return trim(s).length === 0
}

function hasSpaces(s: string): boolean {
  return s.includes(' ')
}

function hasPeriod(s: string): boolean {
  return s.includes('.')
}

function hasAtSign(s: string): boolean {
  return s.includes('@')
}

function isEmptyOrBlank(thing?: string): boolean {
  if (!thing || isBlank(thing)) {
    return true
  }
  return false
}

// Returns an error string if not valid
function isValidCommon(thing?: string): string {
  if (isEmptyOrBlank(thing)) return 'Cannot be blank'
  if (thing && hasSpaces(thing)) return 'No spaces allowed'
  return ''
}

// Returns an error string if not valid
function isValidUsername(username?: string): string {
  if (!username) {
    return ''
  }
  const commonError = isValidCommon(username)
  if (commonError) {
    return commonError
  }
  if (hasPeriod(username)) {
    return "Usernames can't contain periods."
  }
  if (username.startsWith('_')) {
    return "Usernames can't start with an underscore."
  }
  if (username.includes('__')) {
    return "Usernames can't contain double underscores to avoid confusion."
  }
  return ''
}

// Returns an error if not valid
function isValidEmail(email?: string): string {
  const commonError = isValidCommon(email)
  if (!commonError) {
    if (email && hasAtSign(email)) {
      return ''
    }
  }

  return email ? 'Invalid email address.' : 'Empty email address.'
}

// Returns an error string if not valid
function isValidName(name?: string): string {
  if (isEmptyOrBlank(name)) return 'Please provide your name.'
  return ''
}

export {isValidUsername, isValidEmail, isValidName}
