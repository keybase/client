import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as RowSizes from './sizes'
import * as T from '@/constants/types'
import {BigTeamsLabel} from './big-teams-label'

type Props = {
  toggle: () => void
  onEdit?: () => void
}

const BigTeamsDivider = React.memo(function BigTeamsDivider(props: Props) {
  const {toggle, onEdit} = props
  const badgeCount = Chat.useChatState(s => s.bigTeamBadgeCount)
  return (
    <Kb.ClickableBox
      title="Teams with multiple channels."
      onClick={() => {
        T.RPCChat.localRequestInboxSmallResetRpcPromise().catch(() => {})
        toggle()
      }}
      style={styles.container}
    >
      <Kb.Box2
        direction="horizontal"
        style={styles.dividerBox}
        className="color_black_20 hover_color_black_50"
      >
        <BigTeamsLabel />
        {badgeCount > 0 && <Kb.Badge badgeStyle={styles.badge} badgeNumber={badgeCount} />}
        <Kb.Box style={styles.icon}>
          <Kb.Icon type="iconfont-arrow-up" inheritColor={true} fontSize={Kb.Styles.isMobile ? 20 : 16} />
        </Kb.Box>
        {onEdit ? (
          <Kb.BoxGrow2>
            <Kb.Box2 fullWidth={true} direction="vertical" alignItems="flex-end" style={styles.edit}>
              <Kb.Icon type="iconfont-ellipsis" fontSize={Kb.Styles.isMobile ? 20 : 16} onClick={onEdit} />
            </Kb.Box2>
          </Kb.BoxGrow2>
        ) : null}
      </Kb.Box2>
    </Kb.ClickableBox>
  )
})

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
      dividerBox: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          borderStyle: 'solid',
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          height: '100%',
          justifyContent: 'flex-start',
          position: 'relative',
          width: '100%',
        },
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          backgroundColor: Kb.Styles.globalColors.fastBlank,
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      edit: {justifyContent: 'center'},
      icon: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'flex-start',
        justifyContent: 'center',
        marginTop: Kb.Styles.isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)

export default BigTeamsDivider
