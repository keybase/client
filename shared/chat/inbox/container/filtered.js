// @flow
// The filtered inbox rows. No dividers or headers, just smallbig row items
import {createSelector, type TypedState} from '../../../util/container'

const score = (lcFilter: string, lcYou: string, names: Array<string>): number => {
  // special case, looking for yourself
  if (names.length === 1 && names[0] === lcYou) {
    return lcYou.indexOf(lcFilter) !== -1 ? 1 : 0
  }

  const namesMinusYou = names.filter(n => n !== lcYou)
  // special case, comma search
  const filters = lcFilter.split(',').filter(Boolean)
  let filter
  if (filters.length > 1) {
    const mustExist = filters.slice(0, -1)
    const partial = filters.slice(-1)
    // In comma sep. inputs all but the last name must be exact matches
    if (!mustExist.every(m => namesMinusYou.includes(m))) {
      return 0
    }
    filter = partial[0]
  } else {
    filter = filters[0]
  }

  const {foundExact, foundPrefix, foundSub} = namesMinusYou.reduce(
    (data, p) => {
      if (p === filter) {
        data.foundExact += 1
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
  const rawScore = (foundExact ? 1000 : 0) + (foundPrefix ? 100 : 0) + (foundSub ? 10 : 0)
  // We subtract inputLength to give a bonus to shorter groups, but we never want that to make a matching score go to zero
  const inputLength = namesMinusYou.join('').length

  return rawScore > 0 ? Math.max(1, rawScore - inputLength) : 0
}

let _metaMap
// Note: This is NOT a real selector. Instead this fires and stashes into _metaMap a cached copy.
// If the other things change (inboxFilter, username, etc) then they'll just grab the cached value.
// This serves 2 purposes. 1. No thrashing as people are chatting (since we don't show snippets / use the ordering of timestamps)
// and 2. We don't want the results to move around
const fakeGetMetaMap = createSelector([(state: TypedState) => state.chat2.metaMap], metaMap => {
  _metaMap = metaMap
  return null
})

// Ignore headers, score based on matches of participants, ignore total non matches
const getFilteredRowsAndMetadata = createSelector(
  [
    fakeGetMetaMap,
    (state: TypedState) => state.chat2.inboxFilter,
    (state: TypedState) => state.config.username || '',
  ],
  (_, filter, username) => {
    const metas = _metaMap.valueSeq().toArray()
    const lcFilter = filter.toLowerCase()
    const lcYou = username.toLowerCase()
    const smallRows = metas
      .map(meta => {
        if (meta.teamType !== 'big') {
          const s = score(lcFilter, lcYou, meta.teamname ? [meta.teamname] : meta.participants.toArray())
          return s > 0
            ? {
                conversationIDKey: meta.conversationIDKey,
                score: s,
                timestamp: meta.timestamp,
              }
            : null
        } else {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a.score === b.score ? b.timestamp - a.timestamp : b.score - a.score))
      .map(({conversationIDKey}) => ({conversationIDKey, type: 'small'}))

    const bigRows = metas
      .map(meta => {
        if (meta.teamType === 'big') {
          const s = score(lcFilter, '', [meta.teamname, meta.channelname].filter(Boolean))
          return s > 0
            ? {
                channelname: meta.channelname,
                conversationIDKey: meta.conversationIDKey,
                score: s,
                teamname: meta.teamname,
              }
            : null
        } else {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map(({conversationIDKey, channelname, teamname}) => ({
        channelname,
        conversationIDKey,
        teamname,
        type: 'big',
      }))

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
