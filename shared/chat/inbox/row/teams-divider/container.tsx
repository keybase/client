import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/chat2'
import {TeamsDivider} from '.'
import {memoize} from '../../../../util/memoize'

type OwnProps = {
  hiddenCountDelta?: number
  smallTeamsExpanded: boolean
  rows: Array<Types.ChatInboxRowItem>
  showButton: boolean
  toggle: () => void
  style?: Styles.StylesCrossPlatform
}

const getRowCounts = memoize((badges: Types.ConversationCountMap, rows: Array<Types.ChatInboxRowItem>) => {
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
    _smallTeamBadgeCount: state.chat2.smallTeamBadgeCount,
    _totalSmallTeams: state.chat2.inboxLayout?.totalSmallTeams ?? 0,
  }),
  dispatch => ({
    _loadMore: () => dispatch(Chat2Gen.createLoadMoreSmalls()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {rows, showButton, style, hiddenCountDelta, toggle} = ownProps
    const {_badges, _smallTeamBadgeCount, _totalSmallTeams} = stateProps
    // we remove the badge count of the stuff we're showing
    let {badgeCount, hiddenCount} = getRowCounts(_badges, rows)
    badgeCount += _smallTeamBadgeCount
    hiddenCount += _totalSmallTeams
    if (!Styles.isMobile) {
      hiddenCount += hiddenCountDelta ?? 0
    }

    // only show if there's more to load
    const reallyShow = showButton && !!hiddenCount

    return {
      badgeCount: Math.max(0, badgeCount),
      hiddenCount: Math.max(0, hiddenCount),
      loadMore: ownProps.smallTeamsExpanded ? dispatchProps._loadMore : toggle,
      showButton: reallyShow,
      style,
    }
  },
  'TeamsDivider'
)(TeamsDivider)
