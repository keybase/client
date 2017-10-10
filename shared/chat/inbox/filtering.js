// @flow
// Filter helpers for inbox. Onlyl called when there is a filter and alwasy gets a lowercase filter
const passesStringFilter = (filter: string, toCheck: string): boolean => toCheck.indexOf(filter) >= 0

const _passesParticipantFilter = (lcFilter: string, lcParticipants: Array<string>, you: ?string): boolean => {
  if (!lcFilter) {
    return true
  }

  // don't filter you out if its just a convo with you!
  const justYou = lcParticipants.length === 1 && lcParticipants[0] === you
  const names = justYou ? lcParticipants : lcParticipants.filter(p => p !== you)
  return passesStringFilter(lcFilter, names.join(','))
}

// // Simple score for a filter. returns 1 for exact match. 0.75 for full name match
// // in a group conversation. 0.5 for a partial match
// // 0 for no match
const scoreFilter = (
  lcFilter: string,
  lcStringToFilterOn: string,
  lcParticipants: Array<string>,
  lcYou: string
) => {
  if (!lcStringToFilterOn && lcParticipants.length) {
    if (lcFilter === lcYou) {
      return 1
    }
    if (lcParticipants.some(p => p === lcFilter)) {
      return 1 - (lcParticipants.length - 1) / 100 * 0.25
    }

    if (_passesParticipantFilter(lcFilter, lcParticipants, lcYou)) {
      return 0.5
    }
  }

  if (lcFilter === lcStringToFilterOn) {
    return 1
  }

  if (passesStringFilter(lcFilter, lcStringToFilterOn)) {
    return 0.5
  }

  return 0
}

export {scoreFilter, passesStringFilter}
