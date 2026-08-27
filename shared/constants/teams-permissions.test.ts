/// <reference types="jest" />
import type * as T from './types'
import {deriveCanPerform, initialCanUserPerform} from './teams'

const roleAndDetails = (
  role: T.Teams.MaybeTeamRoleType,
  implicitAdmin: boolean
): T.Teams.TeamRoleAndDetails => ({implicitAdmin, role})

describe('deriveCanPerform', () => {
  test('no role and details at all falls back to the all-false operations', () => {
    expect(deriveCanPerform(undefined)).toBe(initialCanUserPerform)
  })

  test('owner can do everything an admin can plus delete the team', () => {
    const owner = deriveCanPerform(roleAndDetails('owner', false))
    const admin = deriveCanPerform(roleAndDetails('admin', false))
    expect(owner.deleteTeam).toBe(true)
    expect(admin.deleteTeam).toBe(false)
    for (const key of Object.keys(admin) as Array<keyof typeof admin>) {
      if (admin[key]) {
        expect(owner[key]).toBe(true)
      }
    }
  })

  test('writer can create channels and manage emojis but not members', () => {
    const writer = deriveCanPerform(roleAndDetails('writer', false))
    expect(writer.createChannel).toBe(true)
    expect(writer.manageEmojis).toBe(true)
    expect(writer.pinMessage).toBe(true)
    expect(writer.renameChannel).toBe(true)
    expect(writer.manageMembers).toBe(false)
    expect(writer.deleteChannel).toBe(false)
    expect(writer.setRetentionPolicy).toBe(false)
  })

  test('reader can chat but nothing else', () => {
    const reader = deriveCanPerform(roleAndDetails('reader', false))
    expect(reader.chat).toBe(true)
    expect(reader.createChannel).toBe(false)
    expect(reader.manageEmojis).toBe(false)
    expect(reader.manageMembers).toBe(false)
  })

  test('bot can chat but cannot create channels', () => {
    const bot = deriveCanPerform(roleAndDetails('bot', false))
    expect(bot.chat).toBe(true)
    expect(bot.createChannel).toBe(false)
    expect(bot.manageEmojis).toBe(false)
  })

  test('restrictedbot and none cannot even chat', () => {
    expect(deriveCanPerform(roleAndDetails('restrictedbot', false)).chat).toBe(false)
    expect(deriveCanPerform(roleAndDetails('none', false)).chat).toBe(false)
  })

  test('implicit admin of a parent team manages the subteam without being a member', () => {
    const implicit = deriveCanPerform(roleAndDetails('none', true))
    expect(implicit.manageMembers).toBe(true)
    expect(implicit.manageSubteams).toBe(true)
    expect(implicit.deleteTeam).toBe(true)
    expect(implicit.renameTeam).toBe(true)
    expect(implicit.listFirst).toBe(true)
    // joinTeam is the implicit-admin-only affordance: they are not a member yet
    expect(implicit.joinTeam).toBe(true)
    // but implicit admin is not membership, so no chat/channel abilities
    expect(implicit.chat).toBe(false)
    expect(implicit.createChannel).toBe(false)
    expect(implicit.setRetentionPolicy).toBe(false)
  })

  test('members never see joinTeam and only implicit admins rename the team', () => {
    for (const role of ['reader', 'writer', 'admin', 'owner'] as const) {
      const ops = deriveCanPerform(roleAndDetails(role, false))
      expect(ops.joinTeam).toBe(false)
      expect(ops.renameTeam).toBe(false)
      expect(ops.listFirst).toBe(false)
    }
  })

  test('results are cached per role+implicitAdmin key and do not bleed across keys', () => {
    const a = deriveCanPerform(roleAndDetails('writer', false))
    const b = deriveCanPerform(roleAndDetails('writer', false))
    expect(a).toBe(b)

    const implicitWriter = deriveCanPerform(roleAndDetails('writer', true))
    expect(implicitWriter).not.toBe(a)
    expect(implicitWriter.manageMembers).toBe(true)
    // the earlier non-implicit entry must be untouched
    expect(deriveCanPerform(roleAndDetails('writer', false)).manageMembers).toBe(false)
  })
})
