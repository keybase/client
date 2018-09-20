// @flow
// The filtered inbox rows. No dividers or headers, just smallbig row items
import * as Types from '../../../constants/types/chat2'
import memoize from 'memoize-one'

const score = (lcFilter: string, lcYou: string, names: Array<string>): number => {
  // special case, looking for yourself
  if (names.length === 1 && names[0] === lcYou) {
    return lcYou.indexOf(lcFilter) !== -1 ? 100000 : 0
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
  let rawScore = (foundExact ? 1000 : 0) + (foundPrefix ? 100 : 0) + (foundSub ? 10 : 0)

  // Special case an exact match that is the only name, otherwise
  // e.g. "chris,chrisnojima" gets a higher score than "chris", when
  // input is "chris" -- (1000 + 100) vs. (1000).
  if (namesMinusYou.length === 1 && foundExact) {
    rawScore += 10000
  }

  // We subtract inputLength to give a bonus to shorter groups, but we never want that to make a matching score go to zero
  const inputLength = namesMinusYou.join('').length

  return rawScore > 0 ? Math.max(1, rawScore - inputLength) : 0
}

const makeSmallItem = (meta, filter, you) => {
  const s = score(filter, you, meta.teamname ? [meta.teamname] : meta.participants.toArray())
  return s > 0
    ? {
        data: {conversationIDKey: meta.conversationIDKey, type: 'small'},
        score: s,
        timestamp: meta.timestamp,
      }
    : null
}

const makeBigItem = (meta, filter) => {
  const s = score(filter, '', [meta.teamname, meta.channelname].filter(Boolean))
  return s > 0
    ? {
        data: {
          channelname: meta.channelname,
          conversationIDKey: meta.conversationIDKey,
          teamname: meta.teamname,
          type: 'big',
        },
        score: s,
        timestamp: 0,
      }
    : null
}

// Ignore headers, score based on matches of participants, ignore total non matches
const getFilteredRowsAndMetadata = memoize((metaMap: Types.MetaMap, filter: string, username: string) => {
  const metas = metaMap.valueSeq().toArray()
  const lcFilter = filter.toLowerCase()
  const lcYou = username.toLowerCase()
  const rows = metas
    .map(
      meta => (meta.teamType !== 'big' ? makeSmallItem(meta, lcFilter, lcYou) : makeBigItem(meta, lcFilter))
    )
    .filter(Boolean)
    .sort((a, b) => {
      if (a.data.type !== b.data.type) {
        return a.data.type === 'small' ? -1 : 1
      }
      return a.score === b.score ? b.timestamp - a.timestamp : b.score - a.score
    })
    .map(({data}) => data)

  return {
    allowShowFloatingButton: false,
    rows,
    smallTeamsExpanded: true,
  }
})

export default getFilteredRowsAndMetadata

export const _testing = {
  score,
}
