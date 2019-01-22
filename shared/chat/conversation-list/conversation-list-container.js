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

const getRows = (stateProps, ownProps: OwnProps) =>
  ownProps.filter
    ? getFilteredRowsAndMetadata(stateProps._metaMap, ownProps.filter, stateProps._username).rows.map(row => {
        // This should never happen to have empty conversationIDKey, but
        // provide default to make flow happy
        const conversationIDKey = row.conversationIDKey || Constants.noConversationIDKey
        const common = {
          conversationIDKey,
          isSelected: conversationIDKey === ownProps.selected,
          onSelectConversation: () => ownProps.onSelect(conversationIDKey),
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
      })
    : getSortedConversationIDKeys(stateProps._metaMap).map(({conversationIDKey, type}) => {
        const common = {
          conversationIDKey,
          isSelected: conversationIDKey === ownProps.selected,
          onSelectConversation: () => ownProps.onSelect(conversationIDKey),
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

const mapStateToProps = state => ({
  _metaMap: state.chat2.metaMap,
  _username: state.config.username,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  filter: ownProps.onSetFilter && {
    filter: ownProps.filter || '',
    isLoading: false,
    onSetFilter: ownProps.onSetFilter,
  },
  rows: getRows(stateProps, ownProps),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConversationList'
)(ConversationList)
