import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as RowSizes from './sizes'

type Props = {
  badgeCount?: number
  hiddenCountDelta?: number
  smallTeamsExpanded: boolean
  showButton: boolean
  hiddenCount: number
  toggle: () => void
  style?: Kb.Styles.StylesCrossPlatform
}

function TeamsDivider(props: Props) {
  const {badgeCount = 0, showButton, style, hiddenCountDelta, toggle, smallTeamsExpanded} = props
  let {hiddenCount} = props

  if (!Kb.Styles.isMobile) {
    hiddenCount += hiddenCountDelta ?? 0
  }

  // only show if there's more to load
  const reallyShow = showButton && !!hiddenCount
  const loadMore = async () => T.RPCChat.localRequestInboxSmallIncreaseRpcPromise().catch(() => {})

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
          label={`+${hiddenCount} more`}
          onClick={smallTeamsExpanded ? loadMore : toggle}
          small={true}
          style={styles.button}
          type="Dim"
        >
          {!!badgeCount && <Kb.Badge badgeNumber={badgeCount} />}
        </Kb.Button>
      )}
      {!reallyShow && (
        <Kb.Text type="BodySmallSemibold" style={styles.dividerText}>
          Big teams
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

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
