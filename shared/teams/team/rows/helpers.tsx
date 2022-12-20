import type * as Types from '../../../constants/types/teams'

// Weights for sorting team members
// 2 is neutral
// lower values come earlier

const order = {admin: 3, owner: 2, reader: 5, writer: 4}

const getWeights = (manageMembers: boolean) => {
  // only weigh actionable statuses higher if we can effect them
  const statusWeights = manageMembers
    ? {
        active: 2,
        deleted: 0,
        reset: 1,
      }
    : {
        active: 2,
        deleted: 2,
        reset: 2,
      }
  return {
    ...order,
    ...statusWeights,
  }
}

export const getOrderedMemberArray = (
  memberInfo: Map<string, Types.MemberInfo> | undefined,
  you: string | null,
  yourOperations: Types.TeamOperations
): Array<Types.MemberInfo> =>
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
          const diff1 = weights[a.status] - weights[b.status]
          const diff2 = weights[a.type] - weights[b.type]
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

export const getOrderedBotsArray = (memberInfo: Map<string, Types.MemberInfo> | undefined) =>
  memberInfo
    ? [...memberInfo.values()]
        .sort((a, b) => a.username.localeCompare(b.username))
        .filter(m => m.type === 'restrictedbot' || m.type === 'bot')
    : []

export const sortInvites = (a: Types.InviteInfo, b: Types.InviteInfo) =>
  (a.email || a.username || a.name || a.id || '').localeCompare(b.email || b.username || b.name || b.id || '')
