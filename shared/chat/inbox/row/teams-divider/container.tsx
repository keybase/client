import {TeamsDivider} from '.'
import {namedConnect, TypedState} from '../../../../util/container'
import {StylesCrossPlatform} from '../../../../styles'
import {RowItem} from '../..'
import {memoize} from '../../../../util/memoize'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Types from '../../../../constants/types/chat2'

type OwnProps = {
  hiddenCountDelta: number
  rows: Array<RowItem>
  showButton: boolean
  toggle: () => void
  style?: StylesCrossPlatform
}

const mapStateToProps = (state: TypedState) => ({
  _badges: state.chat2.badgeMap,
  _inboxLayout: state.chat2.inboxLayout,
})

const getMetaCounts = memoize(
  (badges: Types.ConversationCountMap, inboxLayout: RPCChatTypes.UIInboxLayout | null) => {
    let badgeCount = 0
    let hiddenCount = 0
    const smallTeams = inboxLayout ? inboxLayout.smallTeams || [] : []
    smallTeams.forEach((conv: RPCChatTypes.UIInboxSmallTeamRow) => {
      const id = Types.stringToConversationIDKey(conv.convID)
      badgeCount += badges.get(id) || 0
      hiddenCount++
    })
    return {
      badgeCount,
      hiddenCount,
    }
  }
)

const getRowCounts = memoize((badges, rows) => {
  let badgeCount = 0
  let hiddenCount = 0

  rows.forEach(row => {
    if (row.type === 'small') {
      badgeCount -= badges.get(row.conversationIDKey) || 0
      hiddenCount -= 1
    }
  })

  return {
    badgeCount,
    hiddenCount,
  }
})

export default namedConnect(
  mapStateToProps,
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => {
    // we remove the badge count of the stuff we're showing
    let {badgeCount, hiddenCount} = getRowCounts(stateProps._badges, ownProps.rows)

    if (ownProps.showButton) {
      const fromMeta = getMetaCounts(stateProps._badges, stateProps._inboxLayout)
      badgeCount += fromMeta.badgeCount
      hiddenCount += fromMeta.hiddenCount
    }

    hiddenCount += ownProps.hiddenCountDelta

    return {
      badgeCount,
      hiddenCount,
      showButton: ownProps.showButton,
      style: ownProps.style,
      toggle: ownProps.toggle,
    }
  },
  'TeamsDivider'
)(TeamsDivider) as any
