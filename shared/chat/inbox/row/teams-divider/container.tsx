import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/chat2'
import {RowItem} from '../..'
import {TeamsDivider} from '.'
import {memoize} from '../../../../util/memoize'

type OwnProps = {
  hiddenCountDelta?: number
  smallTeamsExpanded: boolean
  rows: Array<RowItem>
  showButton: boolean
  toggle: () => void
  style?: Styles.StylesCrossPlatform
}

const getMetaCounts = memoize(
  (badges: Types.ConversationCountMap, inboxLayout: RPCChatTypes.UIInboxLayout | null) => {
    let badgeCount = 0
    inboxLayout?.smallTeams?.forEach((conv: RPCChatTypes.UIInboxSmallTeamRow) => {
      const id = Types.stringToConversationIDKey(conv.convID)
      badgeCount += badges.get(id) || 0
    })
    return {
      badgeCount,
      hiddenCount: inboxLayout?.totalSmallTeams ?? 0,
    }
  }
)

const getRowCounts = memoize((badges: Types.ConversationCountMap, rows: Array<RowItem>) => {
  let badgeCount = 0
  let hiddenCount = 0

  rows.forEach(row => {
    if (row.type === 'small') {
      badgeCount -= badges.get(row.conversationIDKey) || 0
      hiddenCount -= 1
    }
  })

  return {badgeCount, hiddenCount}
})

export default Container.namedConnect(
  state => ({
    _badges: state.chat2.badgeMap,
    _inboxLayout: state.chat2.inboxLayout,
  }),
  dispatch => ({
    _loadMore: () => dispatch(Chat2Gen.createLoadMoreSmalls()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {rows, showButton, style, hiddenCountDelta, toggle} = ownProps
    const {_badges, _inboxLayout} = stateProps
    // we remove the badge count of the stuff we're showing
    let {badgeCount, hiddenCount} = getRowCounts(_badges, rows)

    if (showButton) {
      const fromMeta = getMetaCounts(_badges, _inboxLayout)
      badgeCount += fromMeta.badgeCount
      hiddenCount += fromMeta.hiddenCount
    }

    if (!Styles.isMobile) {
      hiddenCount += hiddenCountDelta ?? 0
    }

    // only show if there's more to load
    const reallyShow = showButton && !!hiddenCount

    return {
      badgeCount,
      hiddenCount,
      loadMore: ownProps.smallTeamsExpanded ? dispatchProps._loadMore : toggle,
      showButton: reallyShow,
      style,
    }
  },
  'TeamsDivider'
)(TeamsDivider)
