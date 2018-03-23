// @flow
// The filtered inbox rows. No dividers or headers, just smallbig row items
import {createSelector, type TypedState} from '../../../util/container'

const score = (lcFilter: string, lcYou: string, names: Array<string>): number => {
  // special case, looking for yourself
  if (names.length === 1 && names[0] === lcYou) {
    return lcYou.indexOf(lcFilter) !== -1 ? 1 : 0
  }

  let namesMinusYou = names.filter(n => n !== lcYou)
  // special case, comma search
  const filters = lcFilter.split(',').filter(Boolean)
  let filter
  if (filters.length > 1) {
    const mustExist = filters.slice(0, -1)
    const partial = filters.slice(-1)
    // any names between commas must be exact matches
    if (!mustExist.every(m => namesMinusYou.find(toFind => toFind === m))) {
      return 0
    }
    filter = partial[0]
  } else {
    filter = filters[0]
  }

  const {foundExact, foundPrefix, foundSub} = namesMinusYou.reduce(
    (data, p) => {
      if (p === filter) {
        data.foundExact = true
        return data
      } else {
        const idx = p.indexOf(filter)
        if (idx === 0) {
          data.foundPrefix += 1
          return data
        } else if (idx !== -1) {
          data.foundSub += 1
          return data
        } else {
          return data
        }
      }
    },
    {foundExact: 0, foundPrefix: 0, foundSub: 0}
  )
  return (
    (foundExact ? 1000 : 0) + (foundPrefix ? 100 : 0) + (foundSub ? 10 : 0) - namesMinusYou.join('').length
  )
}

// Ignore headers, score based on matches of participants, ignore total non matches
const getFilteredRowsAndMetadata = createSelector(
  [
    (state: TypedState) => state.chat2.metaMap,
    (state: TypedState) => state.chat2.inboxFilter,
    (state: TypedState) => state.config.username || '',
  ],
  (metaMap, filter, username) => {
    const lcFilter = filter.toLowerCase()
    const lcYou = username.toLowerCase()
    const smallRows = metaMap
      .filter(meta => meta.teamType !== 'big')
      .map(meta => {
        return {
          conversationIDKey: meta.conversationIDKey,
          score: score(lcFilter, lcYou, meta.teamname ? [meta.teamname] : meta.participants.toArray()),
          timestamp: meta.timestamp,
        }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => (a.score === b.score ? b.timestamp - a.timestamp : b.score - a.score))
      .map(({conversationIDKey}) => ({conversationIDKey, type: 'small'}))
      .valueSeq()
      .toArray()

    const bigRows = metaMap
      .filter(meta => meta.teamType === 'big')
      .map(meta => {
        return {
          channelname: meta.channelname,
          conversationIDKey: meta.conversationIDKey,
          score: score(lcFilter, '', [meta.teamname, meta.channelname].filter(Boolean)),
          teamname: meta.teamname,
        }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({conversationIDKey, channelname, teamname}) => ({
        channelname,
        conversationIDKey,
        teamname,
        type: 'big',
      }))
      .valueSeq()
      .toArray()

    return {
      rows: [...smallRows, ...bigRows],
      showBuildATeam: false,
      showSmallTeamsExpandDivider: false,
      smallIDsHidden: [],
      smallTeamsExpanded: true,
    }
  }
)

export default getFilteredRowsAndMetadata

export const _testing = {
  score,
}
