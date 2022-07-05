import {publicAdminsLimit} from '../constants/teams'
import {RetentionPolicy} from '../constants/types/retention-policy'

type SortedAdmins = {
  publicAdmins: Array<string>
  publicAdminsOthers: number
}

// Transforms an array of public admins for display on profile
function parsePublicAdmins(publicAdmins: Array<string>, you: string | null): SortedAdmins {
  const idx = you ? publicAdmins.indexOf(you) : -1
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

// Parses retention policies into a string suitable for display at the top of a conversation
function makeRetentionNotice(
  policy: RetentionPolicy,
  teamPolicy: RetentionPolicy,
  teamType: 'adhoc' | 'big' | 'small'
): string | null {
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
    case 'expire': {
      explanation = `are destroyed after ${policy.title}.`
      break
    }
    case 'inherit': {
      explanation = `${teamPolicy.type === 'explode' ? 'will explode' : 'are destroyed'} after ${
        teamPolicy.title
      }`
      explanation += teamType === 'small' ? '.' : ', the team default.'
      break
    }
    case 'explode': {
      explanation = `will explode after ${policy.title}.`
      break
    }
  }
  return `Messages in this ${convType} ${explanation}`
}

export {makeRetentionNotice, parsePublicAdmins}
