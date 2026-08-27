/// <reference types="jest" />
import type * as T from '@/constants/types'
import {getRolePickerDisabledReasons, isLastOwnerInTeamMembers} from './role-picker-utils'

const member = (username: string, type: T.Teams.TeamRoleType): T.Teams.MemberInfo => ({
  fullName: '',
  needsPUK: false,
  status: 'active',
  type,
  username,
})

const members = (...ms: Array<[string, T.Teams.TeamRoleType]>) =>
  new Map(ms.map(([u, t]) => [u, member(u, t)]))

describe('isLastOwnerInTeamMembers', () => {
  test('false when you are not an owner', () => {
    expect(isLastOwnerInTeamMembers(members(['testuser', 'admin'], ['boss', 'owner']), 'testuser')).toBe(false)
  })

  test('false when you are not in the team at all', () => {
    expect(isLastOwnerInTeamMembers(members(['boss', 'owner']), 'testuser')).toBe(false)
  })

  test('true when you are the only owner', () => {
    expect(
      isLastOwnerInTeamMembers(members(['testuser', 'owner'], ['testuser-mac', 'writer']), 'testuser')
    ).toBe(true)
  })

  test('false when another owner exists', () => {
    expect(
      isLastOwnerInTeamMembers(members(['testuser', 'owner'], ['testuser-mac', 'owner']), 'testuser')
    ).toBe(false)
  })
})

describe('getRolePickerDisabledReasons with manage-members permission', () => {
  test('a subteam never offers owner', () => {
    const reasons = getRolePickerDisabledReasons({
      canManageMembers: true,
      currentUsername: 'testuser',
      members: members(['testuser', 'admin'], ['testuser-mac', 'writer']),
      membersToModify: 'testuser-mac',
      teamname: 'parent.sub',
    })
    expect(reasons).toEqual({owner: 'Subteams cannot have owners.'})
  })

  test('a non-owner admin can change roles but cannot mint owners', () => {
    expect(
      getRolePickerDisabledReasons({
        canManageMembers: true,
        currentUsername: 'testuser',
        members: members(['testuser', 'admin'], ['testuser-mac', 'writer']),
        membersToModify: 'testuser-mac',
        teamname: 'keybase',
      })
    ).toEqual({owner: 'Only owners can turn team members into owners.'})
  })

  test('a non-owner admin cannot touch an owner at all', () => {
    const reasons = getRolePickerDisabledReasons({
      canManageMembers: true,
      currentUsername: 'testuser',
      members: members(['testuser', 'admin'], ['boss', 'owner']),
      membersToModify: 'boss',
      teamname: 'keybase',
    })
    expect(reasons.admin).toBe("Only owners can change another owner's role")
    expect(reasons.writer).toBe("Only owners can change another owner's role")
    expect(reasons.reader).toBe("Only owners can change another owner's role")
    expect(reasons.owner).toBe("Only owners can change another owner's role")
  })

  test('an array containing an owner is treated as modifying an owner', () => {
    const reasons = getRolePickerDisabledReasons({
      canManageMembers: true,
      currentUsername: 'testuser',
      members: members(['testuser', 'admin'], ['boss', 'owner'], ['testuser-mac', 'writer']),
      membersToModify: ['testuser-mac', 'boss'],
      teamname: 'keybase',
    })
    expect(reasons.admin).toBe("Only owners can change another owner's role")
  })

  test('an owner changing someone else has no restrictions', () => {
    expect(
      getRolePickerDisabledReasons({
        canManageMembers: true,
        currentUsername: 'testuser',
        members: members(['testuser', 'owner'], ['testuser-mac', 'writer']),
        membersToModify: 'testuser-mac',
        teamname: 'keybase',
      })
    ).toEqual({})
  })

  test('the last owner cannot demote themselves', () => {
    const reasons = getRolePickerDisabledReasons({
      canManageMembers: true,
      currentUsername: 'testuser',
      members: members(['testuser', 'owner'], ['testuser-mac', 'writer']),
      membersToModify: 'testuser',
      teamname: 'keybase',
    })
    expect(reasons.admin).toBe("You can't demote a team's last owner")
    expect(reasons.writer).toBe("You can't demote a team's last owner")
    expect(reasons.reader).toBe("You can't demote a team's last owner")
    expect(reasons.owner).toBeUndefined()
  })

  test('an owner may demote themselves when another owner remains', () => {
    expect(
      getRolePickerDisabledReasons({
        canManageMembers: true,
        currentUsername: 'testuser',
        members: members(['testuser', 'owner'], ['boss', 'owner']),
        membersToModify: 'testuser',
        teamname: 'keybase',
      })
    ).toEqual({})
  })

  test('demoting yourself and the only other owner together is blocked', () => {
    const reasons = getRolePickerDisabledReasons({
      canManageMembers: true,
      currentUsername: 'testuser',
      members: members(['testuser', 'owner'], ['boss', 'owner']),
      membersToModify: ['testuser', 'boss'],
      teamname: 'keybase',
    })
    expect(reasons.writer).toBe("You can't demote a team's last owner")
  })
})

describe('getRolePickerDisabledReasons without manage-members permission', () => {
  test('a writer cannot change any role', () => {
    const reasons = getRolePickerDisabledReasons({
      canManageMembers: false,
      currentUsername: 'testuser',
      members: members(['testuser', 'writer'], ['testuser-mac', 'reader']),
      membersToModify: 'testuser-mac',
      teamname: 'keybase',
    })
    expect(reasons).toEqual({
      admin: 'You must be at least an admin to make role changes.',
      owner: 'You must be at least an admin to make role changes.',
      reader: 'You must be at least an admin to make role changes.',
      writer: 'You must be at least an admin to make role changes.',
    })
  })

  test('in a subteam the owner reason is the subteam one', () => {
    const reasons = getRolePickerDisabledReasons({
      canManageMembers: false,
      currentUsername: 'testuser',
      members: members(['testuser', 'reader']),
      membersToModify: 'testuser',
      teamname: 'parent.sub',
    })
    expect(reasons.owner).toBe('Subteams cannot have owners.')
    expect(reasons.admin).toBe('You must be at least an admin to make role changes.')
  })

  test('an unknown current user is treated as a reader', () => {
    const reasons = getRolePickerDisabledReasons({
      canManageMembers: false,
      currentUsername: 'stranger',
      members: members(['testuser', 'owner']),
      membersToModify: 'testuser',
      teamname: 'keybase',
    })
    expect(reasons.admin).toBe('You must be at least an admin to make role changes.')
  })

  test('an admin without the permission still cannot change any role', () => {
    expect(
      getRolePickerDisabledReasons({
        canManageMembers: false,
        currentUsername: 'testuser',
        members: members(['testuser', 'admin'], ['testuser-mac', 'writer']),
        membersToModify: 'testuser-mac',
        teamname: 'keybase',
      })
    ).toEqual({
      admin: 'You must be at least an admin to make role changes.',
      owner: 'You must be at least an admin to make role changes.',
      reader: 'You must be at least an admin to make role changes.',
      writer: 'You must be at least an admin to make role changes.',
    })
  })

  test('an owner without the permission still cannot change any role', () => {
    expect(
      getRolePickerDisabledReasons({
        canManageMembers: false,
        currentUsername: 'testuser',
        members: members(['testuser', 'owner'], ['testuser-mac', 'writer']),
        membersToModify: 'testuser-mac',
        teamname: 'keybase',
      })
    ).toEqual({
      admin: 'You must be at least an admin to make role changes.',
      owner: 'You must be at least an admin to make role changes.',
      reader: 'You must be at least an admin to make role changes.',
      writer: 'You must be at least an admin to make role changes.',
    })
  })

  test('with no members to modify every role is still disabled', () => {
    expect(
      getRolePickerDisabledReasons({
        canManageMembers: false,
        currentUsername: 'testuser',
        members: members(['testuser', 'owner']),
        teamname: 'keybase',
      })
    ).toEqual({
      admin: 'You must be at least an admin to make role changes.',
      owner: 'You must be at least an admin to make role changes.',
      reader: 'You must be at least an admin to make role changes.',
      writer: 'You must be at least an admin to make role changes.',
    })
  })
})
