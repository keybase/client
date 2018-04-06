// @flow
import {publicAdminsLimit} from '../constants/teams'
import type {RetentionPolicy} from '../constants/types/teams'

type SortedAdmins = {
  publicAdmins: Array<string>,
  publicAdminsOthers: number,
}

// Transforms an array of public admins for display on profile
function parsePublicAdmins(publicAdmins: Array<string>, you: ?string): SortedAdmins {
  const idx = publicAdmins.indexOf(you)
  if (idx !== -1) {
    const elem = publicAdmins.splice(idx, 1)
    publicAdmins.unshift(...elem)
  }
  // If there are more than six public admins, take the first six and mention
  // the count of the others.
  const publicAdminsOthers =
    publicAdmins.length > publicAdminsLimit ? publicAdmins.length - publicAdminsLimit : 0
  // Remove the public admins past the sixth.
  publicAdmins.splice(publicAdminsLimit, publicAdmins.length - publicAdminsLimit)
  return {publicAdmins, publicAdminsOthers}
}

// Sorts teamnames canonically.
function sortTeamnames(a: string, b: string) {
  const aName = a.toUpperCase()
  const bName = b.toUpperCase()
  if (aName < bName) {
    return -1
  } else if (aName > bName) {
    return 1
  } else {
    return 0
  }
}

// Parses retention polcies into a string suitable for display at the top of a conversation
function makeRetentionNotice(
  policy: RetentionPolicy,
  teamPolicy: RetentionPolicy,
  teamType: 'adhoc' | 'big' | 'small'
): ?string {
  if (policy.type === 'retain' || (policy.type === 'inherit' && teamPolicy.type === 'retain')) {
    // Messages stick around forever; no explanation needed
    return null
  }

  let convType = 'chat'
  if (teamType === 'big') {
    convType = 'channel'
  }
  let explanation = ''
  switch (policy.type) {
    case 'expire':
      explanation = `are destroyed after ${policy.days} days.`
      break
    case 'inherit':
      // teamPolicy can't be retain
      explanation = `are destroyed after ${teamPolicy.days} days`
      explanation += teamType === 'small' ? '.' : ', the team default.'
      break
  }
  return `Messages in this ${convType} ${explanation}`
}

export {makeRetentionNotice, parsePublicAdmins, sortTeamnames}
