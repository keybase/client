import * as Kb from '@/common-adapters'

// red circular badge overlaid on a confirm-modal avatar header; positioning
// comes from the caller since each modal offsets it differently
const AvatarBadge = (props: {
  icon: Kb.IconType
  style?: Kb.Styles.StylesCrossPlatform
  iconStyle?: Kb.Styles.StylesCrossPlatform
}) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2
      direction="horizontal"
      centerChildren={true}
      overflow="hidden"
      style={Kb.Styles.collapseStyles([styles.badge, props.style])}
    >
      <Kb.Icon type={props.icon} color={theme.white} fontSize={14} style={props.iconStyle} />
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  badge: {
    ...Kb.Styles.size(24),
    backgroundColor: theme.red,
    ...Kb.Styles.border(theme.white, 3, 12),
  },
}))

export default AvatarBadge
