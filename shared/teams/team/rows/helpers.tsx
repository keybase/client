import type * as T from '@/constants/types'

// Weights for sorting team members
// 2 is neutral
// lower values come earlier

const getWeights = (manageMembers: boolean) => {
  return new Map([
    ['admin', 3],
    ['owner', 2],
    ['reader', 5],
    ['writer', 4],
    ['active', 2],
    // only weigh actionable statuses higher if we can effect them
    ['deleted', manageMembers ? 0 : 2],
    ['reset', manageMembers ? 1 : 2],
  ])
}

export const getOrderedMemberArray = (
  memberInfo: ReadonlyMap<string, T.Teams.MemberInfo> | undefined,
  you: string | undefined,
  yourOperations: T.Teams.TeamOperations
): Array<T.Teams.MemberInfo> =>
  memberInfo
    ? [...memberInfo.values()]
        .sort((a, b) => {
          // Get listFirst out of the way
          if (yourOperations.listFirst && a.username === you) {
            return -1
          } else if (yourOperations.listFirst && b.username === you) {
            return 1
          }

          const weights = getWeights(yourOperations.manageMembers)
          // Diff the statuses then types. If they're both the same sort alphabetically
          const diff1 = (weights.get(a.status) ?? 0) - (weights.get(b.status) ?? 0)
          const diff2 = (weights.get(a.type) ?? 0) - (weights.get(b.type) ?? 0)
          return diff1 || diff2 || a.username.localeCompare(b.username)
        })
        .filter(
          m =>
            m.type !== 'restrictedbot' &&
            m.type !== 'bot' &&
            // Reset members are included in the "requests" section for admins
            !(m.status === 'reset' && yourOperations.manageMembers)
        )
    : []

export const getOrderedBotsArray = (memberInfo: ReadonlyMap<string, T.Teams.MemberInfo> | undefined) =>
  memberInfo
    ? [...memberInfo.values()]
        .sort((a, b) => a.username.localeCompare(b.username))
        .filter(m => m.type === 'restrictedbot' || m.type === 'bot')
    : []

export const sortInvites = (a: T.Teams.InviteInfo, b: T.Teams.InviteInfo) =>
  (a.email || a.username || a.name || a.id || '').localeCompare(b.email || b.username || b.name || b.id || '')
