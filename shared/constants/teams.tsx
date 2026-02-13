import * as T from './types'
import invert from 'lodash/invert'

export const makeRetentionPolicy = (
  r?: Partial<T.Retention.RetentionPolicy>
): T.Retention.RetentionPolicy => ({
  seconds: 0,
  title: '',
  type: 'retain',
  ...(r || {}),
})

export const serviceRetentionPolicyToRetentionPolicy = (
  policy?: T.RPCChat.RetentionPolicy | null
): T.Retention.RetentionPolicy => {
  // !policy implies a default policy of retainment
  let retentionPolicy: T.Retention.RetentionPolicy = makeRetentionPolicy({type: 'retain'})
  if (policy) {
    // replace retentionPolicy with whatever is explicitly set
    switch (policy.typ) {
      case T.RPCChat.RetentionPolicyType.retain:
        retentionPolicy = makeRetentionPolicy({title: 'Never auto-delete', type: 'retain'})
        break
      case T.RPCChat.RetentionPolicyType.expire: {
        const {expire} = policy
        retentionPolicy = makeRetentionPolicy({
          seconds: expire.age,
          title: baseRetentionPoliciesTitleMap[expire.age] || `${expire.age} seconds`,
          type: 'expire',
        })
        break
      }
      case T.RPCChat.RetentionPolicyType.ephemeral: {
        const {ephemeral} = policy
        retentionPolicy = makeRetentionPolicy({
          seconds: ephemeral.age,
          title: baseRetentionPoliciesTitleMap[ephemeral.age] || `${ephemeral.age} seconds`,
          type: 'explode',
        })
        break
      }
      case T.RPCChat.RetentionPolicyType.inherit:
        retentionPolicy = makeRetentionPolicy({type: 'inherit'})
        break
      default:
    }
  }
  return retentionPolicy
}

const dayInS = 3600 * 24
const policyInherit = makeRetentionPolicy({title: '', type: 'inherit'})
const policyRetain = makeRetentionPolicy({title: 'Never auto-delete', type: 'retain'})
const policyThirtySeconds = makeRetentionPolicy({seconds: 30, title: '30 seconds', type: 'explode'})
const policyFiveMinutes = makeRetentionPolicy({seconds: 5 * 60, title: '5 minutes', type: 'explode'})
const policyOneHour = makeRetentionPolicy({seconds: 3600, title: '60 minutes', type: 'explode'})
const policySixHours = makeRetentionPolicy({seconds: 3600 * 6, title: '6 hours', type: 'explode'})
const policyOneDay = makeRetentionPolicy({seconds: dayInS, title: '24 hours', type: 'explode'})
const policyThreeDays = makeRetentionPolicy({seconds: 3 * dayInS, title: '3 days', type: 'explode'})
const policySevenDays = makeRetentionPolicy({seconds: 7 * dayInS, title: '7 days', type: 'explode'})
const policyMonth = makeRetentionPolicy({seconds: 30 * dayInS, title: '30 days', type: 'expire'})
const policyThreeMonths = makeRetentionPolicy({seconds: 90 * dayInS, title: '90 days', type: 'expire'})
const policySixMonths = makeRetentionPolicy({seconds: 180 * dayInS, title: '180 days', type: 'expire'})
const policyYear = makeRetentionPolicy({seconds: 365 * dayInS, title: '365 days', type: 'expire'})
export const baseRetentionPolicies = [
  policyRetain,
  policyYear,
  policySixMonths,
  policyThreeMonths,
  policyMonth,
  policySevenDays,
  policyThreeDays,
  policyOneDay,
  policySixHours,
  policyOneHour,
  policyFiveMinutes,
  policyThirtySeconds,
]

export const retentionPolicies = {
  policyFiveMinutes,
  policyInherit,
  policyMonth,
  policyOneDay,
  policyOneHour,
  policyRetain,
  policySevenDays,
  policySixHours,
  policySixMonths,
  policyThirtySeconds,
  policyThreeDays,
  policyThreeMonths,
  policyYear,
}

const baseRetentionPoliciesTitleMap = baseRetentionPolicies.reduce<{[key: number]: string}>((map, p) => {
  map[p.seconds] = p.title
  return map
}, {})

export const teamRoleByEnum = invert(T.RPCGen.TeamRole) as unknown as {
  [K in keyof typeof T.RPCGen.TeamRole as (typeof T.RPCGen.TeamRole)[K]]: K
}

export const retentionPolicyToServiceRetentionPolicy = (
  policy: T.Retention.RetentionPolicy
): T.RPCChat.RetentionPolicy => {
  switch (policy.type) {
    case 'retain':
      return {retain: {}, typ: T.RPCChat.RetentionPolicyType.retain}
    case 'expire':
      return {expire: {age: policy.seconds}, typ: T.RPCChat.RetentionPolicyType.expire}
    case 'explode':
      return {ephemeral: {age: policy.seconds}, typ: T.RPCChat.RetentionPolicyType.ephemeral}
    case 'inherit':
      return {inherit: {}, typ: T.RPCChat.RetentionPolicyType.inherit}
  }
}

export const userIsRoleInTeamWithInfo = (
  memberInfo: ReadonlyMap<string, T.Teams.MemberInfo>,
  username: string,
  role: T.Teams.TeamRoleType
): boolean => {
  const member = memberInfo.get(username)
  if (!member) {
    return false
  }
  return member.type === role
}
