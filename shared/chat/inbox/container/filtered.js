// @flow
// The filtered inbox rows. No dividers or headers, just smallbig row items
import {createSelector, type TypedState} from '../../../util/container'

const score = (lcFilter: string, lcYou: string, names: Array<string>): number => {
  // special case, looking for yourself
  if (lcYou === lcFilter) {
    return names.length === 1 && names[0] === lcYou ? 1 : 0
  }

  const namesMinusYou = names.filter(n => n !== lcYou)
  return (
    namesMinusYou.reduce((total, p) => {
      if (p === lcFilter) {
        return total + 1 // exact match
      } else {
        const idx = p.indexOf(lcFilter)
        if (idx === 0) {
          return total + 0.8 // prefix match
        } else if (idx !== -1) {
          return total + 0.5 // sub match
        } else {
          return total
        }
      }
    }, 0) / namesMinusYou.length
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
          score: score(
            lcFilter,
            lcYou,
            [...(meta.teamname || '').split(','), ...meta.participants.toArray()].filter(Boolean)
          ),
        }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
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
