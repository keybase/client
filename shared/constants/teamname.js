// @flow
import * as I from 'immutable'

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

// The types below are copied from ..teams. Can't import them because
// it yields an error, possibly because of an import cycle.

type Teamname = string

type TeamRoleType = 'reader' | 'writer' | 'admin' | 'owner'

type _MemberInfo = {
  type: ?TeamRoleType,
  username: string,
}

type MemberInfo = I.RecordOf<_MemberInfo>

const baseTeamname = (teamname: Teamname): ?Teamname => {
  const i = teamname.lastIndexOf('.')
  if (i < 0) {
    return null
  }

  return teamname.substring(0, i)
}

// ancestorTeamnames returns the parent of the given teamname, and its
// parent, and so on, in order.
const ancestorTeamnames = (teamname: Teamname): Teamname[] => {
  const ancestors = []
  let name = teamname
  while (true) {
    const base = baseTeamname(name)
    if (!base) {
      break
    }
    ancestors.push(base)
    name = base
  }
  return ancestors
}

const isExplicitAdmin = (memberInfo: I.Set<MemberInfo>, user: string) => {
  const info = memberInfo.find(member => member.username === user)
  return info && (info.type === 'owner' || info.type === 'admin')
}

const isImplicitAdmin = (ancestorMemberInfo: I.Map<Teamname, I.Set<MemberInfo>>, user: string) => {
  return ancestorMemberInfo.some(memberInfo => isExplicitAdmin(memberInfo, user))
}

const isAdmin = (
  memberInfo: I.Set<MemberInfo>,
  ancestorMemberInfo: I.Map<Teamname, I.Set<MemberInfo>>,
  user: string
) => {
  return isExplicitAdmin(memberInfo, user) || isImplicitAdmin(ancestorMemberInfo, user)
}

export {validTeamname, baseTeamname, ancestorTeamnames, isAdmin}
