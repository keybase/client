import * as Kb from '@/common-adapters'
import {pluralize} from '@/util/string'

type Props = {
  inlineLayout?: boolean
  onClick: () => void
  unreadCount: number
}

const UnreadShortcut = (props: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.ClickableBox
      direction="horizontal"
      gap="tiny"
      centerChildren={!props.inlineLayout}
      justifyContent={props.inlineLayout ? 'flex-start' : undefined}
      alignItems="center"
      fullWidth={true}
      onClick={props.onClick}
      style={Kb.Styles.collapseStyles([
        props.inlineLayout ? styles.containerInline : styles.container,
        props.inlineLayout ? styles.unreadShortcutInline : styles.unreadShortcut,
      ])}
    >
      <Kb.Icon type="iconfont-arrow-down" sizeType="Small" color={theme.white} />
      <Kb.Text negative={true} type="BodySmallSemibold">
        {props.inlineLayout
          ? `${props.unreadCount} unread`
          : `${props.unreadCount} unread ${pluralize('message', props.unreadCount)}`}
      </Kb.Text>
    </Kb.ClickableBox>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
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
          backgroundColor: theme.orange_90,
          ...Kb.Styles.paddingV(Kb.Styles.globalMargins.tiny),
        },
        isElectron: {height: 32},
        isMobile: {height: 40},
      }),
      unreadShortcutInline: {
        backgroundColor: theme.orange_90,
        flex: 1,
        ...Kb.Styles.paddingV(Kb.Styles.globalMargins.tiny),
        paddingLeft: Kb.Styles.globalMargins.small,
      },
    }) as const
)

export default UnreadShortcut
