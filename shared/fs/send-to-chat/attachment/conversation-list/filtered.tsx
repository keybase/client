// The filtered inbox rows. No dividers or headers, just smallbig row items
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {memoize} from '../../../../util/memoize'
import {makeInsertMatcher} from '../../../../util/string'
import {RowItem} from '../../../../chat/inbox'

const score = (lcFilter: string, lcYou: string, names: Array<string>, insertMatcher?: RegExp): number => {
  // special case, looking for yourself
  if (names.length === 1 && names[0] === lcYou) {
    return lcYou.indexOf(lcFilter) !== -1 ? 100000 : 0
  }

  const namesMinusYou = lcYou ? names.filter(n => n !== lcYou) : names
  // special case, comma search
  const filters = lcFilter.split(',').filter(Boolean)
  let filter: string
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
        }
        return data
      }
    },
    {foundExact: 0, foundPrefix: 0, foundSub: 0}
  )

  const searchStr = namesMinusYou.join('')
  const insertionMatch = insertMatcher && searchStr.match(insertMatcher)
  // insertionDistance = searchStr.length - filter.length
  // 1 / (insertionDistance + 1) * 20
  // 20 <= insertionScore < 0
  let insertionScore = 0
  if (filter) {
    insertionScore = insertionMatch ? (1 / (searchStr.length - filter.length + 1)) * 20 : 0
  }

  let rawScore = (foundExact ? 1000 : 0) + (foundPrefix ? 100 : 0) + insertionScore + (foundSub ? 10 : 0)

  // Special case an exact match that is the only name, otherwise
  // e.g. "chris,chrisnojima" gets a higher score than "chris", when
  // input is "chris" -- (1000 + 100) vs. (1000).
  if (namesMinusYou.length === 1 && foundExact) {
    rawScore += 10000
  }

  if (rawScore && rawScore === insertionScore) {
    // insertionScore already penalizes long names, don't do it again below
    return rawScore
  }

  // We subtract inputLength to give a bonus to shorter groups, but we never want that to make a matching score go to zero
  const inputLength = searchStr.length

  return rawScore > 0 ? Math.max(1, rawScore - inputLength) : 0
}

type SortedRowItem = {score: number; timestamp: number; data: RowItem}
// Ignore headers, score based on matches of participants, ignore total non matches
const getFilteredRowsAndMetadata = memoize(
  (inboxLayout: RPCChatTypes.UIInboxLayout, _filter: string, _username: string) => {
    const you = _username.toLowerCase()
    const filter = _filter.toLowerCase()
    const insertMatcher = makeInsertMatcher(filter)

    const smallRows: Array<SortedRowItem> = inboxLayout.smallTeams
      ? inboxLayout.smallTeams.reduce<Array<SortedRowItem>>((arr, t) => {
          const s = score(filter, you, t.name.split(','), insertMatcher)
          if (s > 0) {
            arr.push({
              data: {
                conversationIDKey: t.convID,
                isTeam: t.isTeam,
                snippetDecoration: RPCChatTypes.SnippetDecoration.none,
                teamname: t.name,
                time: 0,
                type: 'small',
              } as const,
              score: s,
              timestamp: t.time,
            })
          }
          return arr
        }, [])
      : []
    const bigRows: Array<SortedRowItem> = inboxLayout.bigTeams
      ? inboxLayout.bigTeams.reduce<Array<SortedRowItem>>((arr, t) => {
          if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
            const s = score(
              filter,
              '',
              [t.channel.teamname, t.channel.channelname].filter(Boolean),
              insertMatcher
            )
            if (s > 0) {
              arr.push({
                data: {
                  channelname: t.channel.channelname,
                  conversationIDKey: t.channel.convID,
                  snippetDecoration: RPCChatTypes.SnippetDecoration.none,
                  teamname: t.channel.teamname,
                  type: 'big',
                } as const,
                score: s,
                timestamp: 0,
              })
            }
          }

          return arr
        }, [])
      : []

    const rows: Array<RowItem> = [...smallRows, ...bigRows]
      .sort((a, b) => {
        return a.score === b.score ? b.timestamp - a.timestamp : b.score - a.score
      })
      .map(({data}) => data as RowItem)

    return {
      allowShowFloatingButton: false,
      rows,
      smallTeamsExpanded: true,
    }
  }
)

export default getFilteredRowsAndMetadata

export const _testing = {
  score,
}
