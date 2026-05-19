import * as Kb from '@/common-adapters'
import {pluralize} from '@/util/string'

type Props = {
  inlineLayout?: boolean
  onClick: () => void
  unreadCount: number
}

const UnreadShortcut = (props: Props) => (
  <Kb.ClickableBox2 onClick={props.onClick} style={props.inlineLayout ? styles.containerInline : styles.container}>
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      centerChildren={true}
      fullWidth={true}
      style={props.inlineLayout ? styles.unreadShortcutInline : styles.unreadShortcut}
    >
      <Kb.Icon type="iconfont-arrow-down" sizeType="Small" color={Kb.Styles.globalColors.white} />
      <Kb.Text negative={true} type="BodySmallSemibold">
        {props.inlineLayout
          ? `${props.unreadCount} unread`
          : `${props.unreadCount} unread ${pluralize('message', props.unreadCount)}`}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
      },
      containerInline: {
        flex: 1,
        height: '100%',
      },
      unreadShortcut: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.orange_90,
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {height: 32},
        isMobile: {height: 40},
      }),
      unreadShortcutInline: {
        backgroundColor: Kb.Styles.globalColors.orange_90,
        flex: 1,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default UnreadShortcut
