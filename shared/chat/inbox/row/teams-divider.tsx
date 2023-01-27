import * as React from 'react'
import type * as Types from '../../../constants/types/chat2'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as RowSizes from './sizes'
import {memoize} from '../../../util/memoize'
import shallowEqual from 'shallowequal'

type Props = {
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

const TeamsDivider = React.memo(function TeamsDivider(props: Props) {
  const {rows, showButton, style, hiddenCountDelta, toggle, smallTeamsExpanded} = props
  const {badges, smallTeamBadgeCount, totalSmallTeams} = Container.useSelector(state => {
    const badges = state.chat2.badgeMap
    const smallTeamBadgeCount = state.chat2.smallTeamBadgeCount
    const totalSmallTeams = state.chat2.inboxLayout?.totalSmallTeams ?? 0
    return {badges, smallTeamBadgeCount, totalSmallTeams}
  }, shallowEqual)
  // we remove the badge count of the stuff we're showing
  let {badgeCount, hiddenCount} = getRowCounts(badges, rows)
  badgeCount += smallTeamBadgeCount
  hiddenCount += totalSmallTeams
  if (!Styles.isMobile) {
    hiddenCount += hiddenCountDelta ?? 0
  }

  // only show if there's more to load
  const reallyShow = showButton && !!hiddenCount
  const loadMore = async () => RPCChatTypes.localRequestInboxSmallIncreaseRpcPromise().catch(() => {})

  badgeCount = Math.max(0, badgeCount)
  hiddenCount = Math.max(0, hiddenCount)

  return (
    <Kb.Box2
      direction="vertical"
      style={Styles.collapseStyles([reallyShow ? styles.containerButton : styles.containerNoButton, style])}
      gap="tiny"
      gapStart={true}
      gapEnd={true}
    >
      {reallyShow && (
        <Kb.Button
          badgeNumber={badgeCount}
          label={`+${hiddenCount} more`}
          onClick={smallTeamsExpanded ? loadMore : toggle}
          small={true}
          style={styles.button}
          type="Dim"
        />
      )}
      {!reallyShow && (
        <Kb.Text type="BodySmallSemibold" style={styles.dividerText}>
          Big teams
        </Kb.Text>
      )}
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {
        alignSelf: 'center',
        bottom: Styles.globalMargins.tiny,
        position: 'relative',
        width: undefined,
      },
      containerButton: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxColumn,
          flexShrink: 0,
          height: RowSizes.dividerHeight(true),
          justifyContent: 'center',
          width: '100%',
        },
        isElectron: {backgroundColor: Styles.globalColors.blueGrey},
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
      containerNoButton: {
        ...Styles.globalStyles.flexBoxColumn,
        flexShrink: 0,
        height: RowSizes.dividerHeight(false),
        justifyContent: 'center',
        width: '100%',
      },
      dividerText: {
        alignSelf: 'flex-start',
        marginLeft: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
      },
    } as const)
)

export default TeamsDivider
