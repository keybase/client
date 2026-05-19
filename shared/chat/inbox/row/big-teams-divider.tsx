import * as Kb from '@/common-adapters'
import * as RowSizes from './sizes'
import * as T from '@/constants/types'
import {BigTeamsLabel} from './big-teams-label'
import {useConfigState} from '@/stores/config'

type Props = {
  inlineLayout?: boolean
  toggle: () => void
  onEdit?: () => void
}

const BigTeamsDivider = (props: Props) => {
  const {inlineLayout, toggle, onEdit} = props
  const badgeCount = useConfigState(s => s.badgeState?.bigTeamBadgeCount ?? 0)
  const containerStyle = Kb.Styles.collapseStyles([
    styles.container,
    inlineLayout ? styles.inlineContainer : undefined,
  ])
  return (
    <Kb.ClickableBox2
      onClick={() => {
        T.RPCChat.localRequestInboxSmallResetRpcPromise().catch(() => {})
        toggle()
      }}
      style={containerStyle}
    >
      {inlineLayout ? (
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          alignItems="center"
          justifyContent="flex-start"
          gap="xtiny"
          style={styles.dividerBoxInline}
          className="color_black_20 hover_color_black_50"
        >
          <Kb.Icon type="iconfont-arrow-up" color="inherit" fontSize={20} />
          <Kb.Text type="BodySmallSemibold">Big teams</Kb.Text>
          {badgeCount > 0 && <Kb.Badge badgeStyle={styles.badge} badgeNumber={badgeCount} />}
        </Kb.Box2>
      ) : (
        <Kb.Box2
          direction="horizontal"
          justifyContent="flex-start"
          style={styles.dividerBox}
          className="color_black_20 hover_color_black_50"
        >
          <BigTeamsLabel />
          {badgeCount > 0 && <Kb.Badge badgeStyle={styles.badge} badgeNumber={badgeCount} />}
          <Kb.Box2 direction="horizontal" alignItems="flex-start" justifyContent="center" style={styles.icon}>
            <Kb.Icon type="iconfont-arrow-up" color="inherit" fontSize={isMobile ? 20 : 16} />
          </Kb.Box2>
          {onEdit ? (
            <Kb.BoxGrow2>
              <Kb.Box2 fullWidth={true} direction="vertical" alignItems="flex-end" justifyContent="center">
                <Kb.Icon type="iconfont-ellipsis" fontSize={isMobile ? 20 : 16} onClick={onEdit} />
              </Kb.Box2>
            </Kb.BoxGrow2>
          ) : null}
        </Kb.Box2>
      )}
    </Kb.ClickableBox2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginRight: 0,
        position: 'relative',
      },
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.fillAbsolute,
          backgroundColor: Kb.Styles.globalColors.blueLighter3,
          flexShrink: 0,
          height: RowSizes.floatingDivider,
          top: undefined,
        },
        isMobile: {
          backgroundColor: Kb.Styles.globalColors.white,
          bottom: 0,
          flexShrink: 0,
          height: RowSizes.floatingDivider,
          left: 0,
          position: 'absolute',
          right: 0,
        },
      }),
      inlineContainer: Kb.Styles.platformStyles({
        isMobile: {
          backgroundColor: 'transparent',
          bottom: undefined,
          flex: 1,
          flexShrink: 1,
          height: '100%',
          left: undefined,
          position: 'relative',
          right: undefined,
        },
      }),
      dividerBoxInline: {
        flex: 1,
        height: '100%',
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
      dividerBox: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          borderStyle: 'solid',
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          height: '100%',
          position: 'relative',
          width: '100%',
        },
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      icon: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        marginTop: isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)

export default BigTeamsDivider
