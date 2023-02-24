import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as RowSizes from './sizes'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import {BigTeamsLabel} from './big-teams-label'

type Props = {
  toggle: () => void
}

const BigTeamsDivider = React.memo(function BigTeamsDivider(props: Props) {
  const {toggle} = props
  const badgeCount = Container.useSelector(state => state.chat2.bigTeamBadgeCount)
  return (
    <Kb.ClickableBox
      title="Teams with multiple channels."
      onClick={() => {
        RPCChatTypes.localRequestInboxSmallResetRpcPromise().catch(() => {})
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
          <Kb.Icon type="iconfont-arrow-up" inheritColor={true} fontSize={Styles.isMobile ? 20 : 16} />
        </Kb.Box>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        marginLeft: Styles.globalMargins.xtiny,
        marginRight: 0,
        position: 'relative',
      },
      container: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.fillAbsolute,
          backgroundColor: Styles.globalColors.blueLighter3,
          flexShrink: 0,
          height: RowSizes.floatingDivider,
          top: undefined,
        },
        isMobile: {
          backgroundColor: Styles.globalColors.white,
          bottom: 0,
          flexShrink: 0,
          height: RowSizes.floatingDivider,
          left: 0,
          position: 'absolute',
          right: 0,
        },
      }),
      dividerBox: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          borderStyle: 'solid',
          borderTopColor: Styles.globalColors.black_10,
          borderTopWidth: 1,
          height: '100%',
          justifyContent: 'flex-start',
          position: 'relative',
          width: '100%',
        },
        isElectron: {
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
        },
        isMobile: {
          backgroundColor: Styles.globalColors.fastBlank,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
      }),
      icon: {
        ...Styles.globalStyles.fillAbsolute,
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'flex-start',
        justifyContent: 'center',
        marginTop: Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.xtiny,
      },
    } as const)
)

export default BigTeamsDivider
