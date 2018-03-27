// @flow
import {publicAdminsLimit} from '../constants/teams'

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

export {parsePublicAdmins, sortTeamnames}
