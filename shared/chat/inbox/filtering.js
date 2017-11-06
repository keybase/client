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

const scoreFilterName = (
  lcFilter: string,
  lcStringToFilterOn: string,
  lcParticipants: Array<string>,
  lcYou: string
) => {
  // If we end up inside this if, that means we are scoring a non-team conversation.
  if (!lcStringToFilterOn && lcParticipants.length) {
    // We favor smaller groups here, with a conversation of size 1 giving the best score. A conversation
    // with 100 participants would score 0.75. NOTE: anything over 100 will start to fall below 0.75.
    if (lcParticipants.some(p => p === lcFilter)) {
      return 1 - (lcParticipants.length - 1) / 100 * 0.25
    }

    // As long as we hit something on the conversation, we give it a 0.5
    if (_passesParticipantFilter(lcFilter, lcParticipants, lcYou)) {
      return 0.5
    }
  }

  // This likely is checking the team name of the conversation against the filter. If we get any sort
  // of hit we just give it 0.5
  if (passesStringFilter(lcFilter, lcStringToFilterOn)) {
    return 0.5
  }

  return 0
}

const scoreFilterTime = (lcTime: number) => {
  // Give a score for how old the time is on a scale of now to 2 weeks ago. Anything older
  // than two weeks is just all the same to us.
  const timeVal = 1 - (Date.now() - lcTime) / (86400 * 14 * 1000)
  return Math.min(1, Math.max(0, timeVal))
}

const isExactMatch = (
  lcFilter: string,
  lcStringToFilterOn: string,
  lcParticipants: Array<string>,
  lcYou: string
) => {
  const partsWithoutYou = lcParticipants.filter(p => p !== lcYou)
  if (lcStringToFilterOn) {
    // Exact match on the supplied name (usually a team name)
    return lcFilter === lcStringToFilterOn
  } else if (partsWithoutYou.length === 1) {
    // Exact match on a the convo name without yourself in it (ex. mikem,max exact matches max when mikem
    // searches.
    return partsWithoutYou[0] === lcFilter
  } else {
    // Special case when searching for the conversation with yourself
    return lcParticipants.length === 1 && lcParticipants[0] === lcFilter && lcFilter === lcYou
  }
}

// Simple score for a filter.  Weight two quantities equally: the quality of the name match, and how
// recent the conversation has changed. If it is an exact match, we return a score of 1.
// [1,0.75] for full name match in a group conversation. 0.5 for a partial match and 0 for no match.
// The time score is a value that gives max score to a conversation that has changed at the current time,
// and a 0 to any conversation older than two weeks ago, with a range in between.
const scoreFilter = (
  lcFilter: string,
  lcStringToFilterOn: string,
  lcParticipants: Array<string>,
  lcYou: string,
  lcTime: number
) => {
  // Check exact match first to early out with a max score
  if (isExactMatch(lcFilter, lcStringToFilterOn, lcParticipants, lcYou)) {
    return 1
  }
  // Grab the name score first since it also acts as a filter. A score of 0 here indicates no match.
  const nameScore = scoreFilterName(lcFilter, lcStringToFilterOn, lcParticipants, lcYou)
  let timeScore = 0
  if (nameScore > 0) {
    // Run the time score if we hit a match at all
    timeScore = scoreFilterTime(lcTime)
  }
  // Weight the two score equally for our final result
  return 0.5 * nameScore + 0.5 * timeScore
}

export {scoreFilter, passesStringFilter}
