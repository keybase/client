import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {pluralize} from '../../util/string'

type Props = {
  onClick: () => void
  unreadCount: number
}

const UnreadShortcut = (props: Props) => (
  <Kb.ClickableBox onClick={props.onClick} style={styles.container}>
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      centerChildren={true}
      fullWidth={true}
      style={styles.unreadShortcut}
    >
      <Kb.Icon type="iconfont-arrow-down" sizeType="Small" color={Styles.globalColors.white} />
      <Kb.Text negative={true} type="BodySmallSemibold">
        {props.unreadCount} unread {pluralize('message', props.unreadCount)}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
      },
      unreadShortcut: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.orange_90,
          paddingBottom: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.tiny,
        },
        isElectron: {height: 32},
        isMobile: {height: 40},
      }),
    } as const)
)

export default UnreadShortcut
