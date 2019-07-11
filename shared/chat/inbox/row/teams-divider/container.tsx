import {TeamsDivider} from '.'
import {namedConnect} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import {StylesCrossPlatform} from '../../../../styles'
import {RowItem} from '../../index.types'
import {memoize} from '../../../../util/memoize'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

type OwnProps = {
  rows: Array<RowItem>
  showButton: boolean
  toggle: () => void
  style?: StylesCrossPlatform
}

const mapStateToProps = state => ({_badges: state.chat2.badgeMap, _metaMap: state.chat2.metaMap})

const getMetaCounts = memoize((badges, metaMap) => {
  let badgeCount = 0
  let hiddenCount = 0
  metaMap.forEach(meta => {
    if (meta.teamType === 'big') {
      return
    }
    if (meta.status === RPCChatTypes.ConversationStatus.ignored) {
      return
    }
    const id = meta.conversationIDKey
    if (!Constants.isValidConversationIDKey(id)) {
      return
    }

    badgeCount += badges.get(id, 0)
    hiddenCount++
  })
  return {
    badgeCount,
    hiddenCount,
  }
})

const getRowCounts = memoize((badges, rows) => {
  let badgeCount = 0
  let hiddenCount = 0

  rows.forEach(row => {
    if (row.type === 'small') {
      badgeCount -= badges.get(row.conversationIDKey, 0)
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
      const fromMeta = getMetaCounts(stateProps._badges, stateProps._metaMap)
      badgeCount += fromMeta.badgeCount
      hiddenCount += fromMeta.hiddenCount
    }

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
