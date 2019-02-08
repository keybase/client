// @flow
import {namedConnect} from '../../util/container'
import {memoize} from '../../util/memoize'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import * as Flow from '../../util/flow'
import {isMobile} from '../../constants/platform'
import ConversationList, {type SmallTeamRowItem, type BigTeamChannelRowItem} from './conversation-list'
import getFilteredRowsAndMetadata from '../inbox/container/filtered'

type OwnProps = {|
  filter?: string,
  onDone?: ?() => void,
  onSelect: (conversationIDKey: Types.ConversationIDKey) => void,
  onSetFilter?: (filter: string) => void,
  selected: Types.ConversationIDKey, // mobile only
|}

const notificationsTypeToNumber = (t: Types.NotificationsType): number => {
  switch (t) {
    case 'onAnyActivity':
      return 1
    case 'onWhenAtMentioned':
      return 2
    case 'never':
      return 3
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(t)
      return 0
  }
}

const boolToNumber = (b: boolean): number => (b ? 1 : 0)

const staleToNumber = (convTime: number, staleCutoff: number) => (convTime < staleCutoff ? 1 : 0)

const getAWeekAgo = () => {
  let t = new Date()
  return t.setDate(t.getDate() - 7) // works fine for cross-boundary; returns a number
}

const getSortedConversationIDKeys = memoize(
  (metaMap: Types.MetaMap): Array<{conversationIDKey: Types.ConversationIDKey, type: 'small' | 'big'}> => {
    const staleCutoff = getAWeekAgo()
    return metaMap
      .valueSeq()
      .toArray()
      .sort((a, b) => {
        // leveled order rules:
        // 1. unmuted before muted
        // 2. active conversations before inactive (has activity in the past week)
        // 3. notification type: onAnyActivity before onWhenAtMentioned, before never
        // 4. activity timestamp being the last tie breaker
        const mutedBased = boolToNumber(a.isMuted) - boolToNumber(b.isMuted)
        if (mutedBased !== 0) {
          return mutedBased
        }
        const staleBased = staleToNumber(a.timestamp, staleCutoff) - staleToNumber(b.timestamp, staleCutoff)
        if (staleBased !== 0) {
          return staleBased
        }
        const notificationsTypeBased = isMobile
          ? notificationsTypeToNumber(a.notificationsMobile) -
            notificationsTypeToNumber(b.notificationsMobile)
          : notificationsTypeToNumber(a.notificationsDesktop) -
            notificationsTypeToNumber(b.notificationsDesktop)
        if (notificationsTypeBased !== 0) {
          return notificationsTypeBased
        }
        return b.timestamp - a.timestamp
      })
      .filter(({conversationIDKey}) => conversationIDKey !== Constants.noConversationIDKey)
      .map(({conversationIDKey, teamType}) => ({
        conversationIDKey,
        type: teamType === 'big' ? 'big' : 'small',
      }))
  }
)

const getRows = (stateProps, ownProps: OwnProps) => {
  let selectedIndex = null
  const rows = ownProps.filter
    ? getFilteredRowsAndMetadata(stateProps._metaMap, ownProps.filter, stateProps._username).rows.map(
        (row, index) => {
          // This should never happen to have empty conversationIDKey, but
          // provide default to make flow happy
          const conversationIDKey = row.conversationIDKey || Constants.noConversationIDKey
          const common = {
            conversationIDKey,
            isSelected: conversationIDKey === ownProps.selected,
            onSelectConversation: () => {
              ownProps.onSelect(conversationIDKey)
              ownProps.onDone && ownProps.onDone()
            },
          }
          if (common.isSelected) {
            selectedIndex = index
          }
          return row.type === 'big'
            ? ({
                ...common,
                type: 'big',
              }: BigTeamChannelRowItem)
            : ({
                ...common,
                type: 'small',
              }: SmallTeamRowItem)
        }
      )
    : getSortedConversationIDKeys(stateProps._metaMap).map(({conversationIDKey, type}, index) => {
        const common = {
          conversationIDKey,
          isSelected: conversationIDKey === ownProps.selected,
          onSelectConversation: () => {
            ownProps.onSelect(conversationIDKey)
            ownProps.onDone && ownProps.onDone()
          },
        }
        if (common.isSelected) {
          selectedIndex = index
        }
        return type === 'big'
          ? ({
              ...common,
              type: 'big',
            }: BigTeamChannelRowItem)
          : ({
              ...common,
              type: 'small',
            }: SmallTeamRowItem)
      })
  return {rows, selectedIndex}
}

const mapStateToProps = state => ({
  _metaMap: state.chat2.metaMap,
  _username: state.config.username,
})

const mapDispatchToProps = dispatch => ({})

const selectNext = (rows, current, delta) => {
  if (!rows.length) {
    return null
  }
  const nextIndex = (current === null ? (delta > 0 ? 0 : rows.length - 1) : current + delta) % rows.length
  if (rows[nextIndex].type === 'more-less') {
    const row = rows[(nextIndex + 1) % rows.length]
    // two 'more-less' in a row: either that's the only we have or something's
    // wrong elsewhere.
    return row.type === 'more-less' ? null : row.conversationIDKey
  }
  return rows[nextIndex].conversationIDKey
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {selectedIndex, rows} = getRows(stateProps, ownProps)
  return {
    filter: ownProps.onSetFilter && {
      filter: ownProps.filter || '',
      isLoading: false,
      onSetFilter: ownProps.onSetFilter,
    },
    onEnsureSelection: () => {
      if (selectedIndex === null) {
        const nextConvIDKey = selectNext(rows, selectedIndex, 1)
        nextConvIDKey && ownProps.onSelect(nextConvIDKey)
      }
      ownProps.onDone && ownProps.onDone()
    },
    onSelectDown: () => {
      const nextConvIDKey = selectNext(rows, selectedIndex, 1)
      nextConvIDKey && ownProps.onSelect(nextConvIDKey)
    },
    onSelectUp: () => {
      const nextConvIDKey = selectNext(rows, selectedIndex, -1)
      nextConvIDKey && ownProps.onSelect(nextConvIDKey)
    },
    rows,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConversationList'
)(ConversationList)
