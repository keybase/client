// @flow

import {type Teamname} from '../constants/teams'

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

const baseTeamname = (teamname: Teamname): ?Teamname => {
  const i = teamname.lastIndexOf('.')
  if (i < 0) {
    return null
  }

  return teamname.substring(0, i)
}

const ancestorTeamnames = (teamname: Teamname): Teamname[] => {
  const ancestors = []
  let name = teamname
  while (true) {
    const base = baseTeamname(name)
    if (!base) {
      break
    }
    ancestors.push(name)
    name = base
  }
  return ancestors
}

export {validTeamname, baseTeamname, ancestorTeamnames}
