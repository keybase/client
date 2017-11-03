// @flow

// This logic is copied from go/protocol/keybase1/extras.go.

const validTeamnamePart = (s: string): boolean => {
  if (s.length < 2 || s.length > 16) {
    return false
  }

  return /^([a-zA-Z0-9][a-zA-Z0-9_]?)+$/.test(s)
}

const validTeamname = (s: string): boolean => {
  return s.split('.').every(validTeamnamePart)
}

const baseTeamname = (s: string): ?string => {
  const i = s.lastIndexOf('.')
  if (i < 0) {
    return null
  }

  return s.substring(0, i)
}

export {validTeamname, baseTeamname}
