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

// The type below is copied from ..teams. Can't import it because
// doing so yields an error, possibly because of an import cycle.

type Teamname = string

const baseTeamname = (teamname: Teamname): ?Teamname => {
  const i = teamname.lastIndexOf('.')
  if (i < 0) {
    return null
  }

  return teamname.substring(0, i)
}

export {validTeamname, baseTeamname}
