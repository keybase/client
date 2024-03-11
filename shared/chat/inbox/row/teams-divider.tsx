import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import * as RowSizes from './sizes'

type Props = {
  hiddenCountDelta?: number
  smallTeamsExpanded: boolean
  rows: Array<T.Chat.ChatInboxRowItem>
  showButton: boolean
  toggle: () => void
  style?: Kb.Styles.StylesCrossPlatform
}

const getRowCounts = (badges: T.Chat.ConversationCountMap, rows: Array<T.Chat.ChatInboxRowItem>) => {
  let badgeCount = 0
  let hiddenCount = 0

  rows.forEach(row => {
    if (row.type === 'small') {
      badgeCount -= badges.get(row.conversationIDKey) || 0
      hiddenCount -= 1
    }
  })

  return {badgeCount, hiddenCount}
}

const TeamsDivider = React.memo(function TeamsDivider(props: Props) {
  const {rows, showButton, style, hiddenCountDelta, toggle, smallTeamsExpanded} = props
  const smallTeamBadgeCount = C.useChatState(s => s.smallTeamBadgeCount)
  const totalSmallTeams = C.useChatState(s => s.inboxLayout?.totalSmallTeams ?? 0)
  const badgeCountsChanged = C.useChatState(s => s.badgeCountsChanged)
  const badges = React.useMemo(() => {
    return C.useChatState.getState().getBadgeMap(badgeCountsChanged)
  }, [badgeCountsChanged])
  // we remove the badge count of the stuff we're showing
  let {badgeCount, hiddenCount} = React.useMemo(() => getRowCounts(badges, rows), [badges, rows])
  badgeCount += smallTeamBadgeCount
  hiddenCount += totalSmallTeams
  if (!Kb.Styles.isMobile) {
    hiddenCount += hiddenCountDelta ?? 0
  }

  // only show if there's more to load
  const reallyShow = showButton && !!hiddenCount
  const loadMore = async () => T.RPCChat.localRequestInboxSmallIncreaseRpcPromise().catch(() => {})

  badgeCount = Math.max(0, badgeCount)
  hiddenCount = Math.max(0, hiddenCount)

  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([
        reallyShow ? styles.containerButton : styles.containerNoButton,
        style,
      ])}
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      button: {
        alignSelf: 'center',
        bottom: Kb.Styles.globalMargins.tiny,
        position: 'relative',
        width: undefined,
      },
      containerButton: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          flexShrink: 0,
          height: RowSizes.dividerHeight(true),
          justifyContent: 'center',
          width: '100%',
        },
        isElectron: {backgroundColor: Kb.Styles.globalColors.blueGrey},
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      containerNoButton: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        flexShrink: 0,
        height: RowSizes.dividerHeight(false),
        justifyContent: 'center',
        width: '100%',
      },
      dividerText: {
        alignSelf: 'flex-start',
        marginLeft: Kb.Styles.globalMargins.tiny,
        marginRight: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default TeamsDivider
