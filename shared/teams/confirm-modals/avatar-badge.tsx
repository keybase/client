import * as Kb from '@/common-adapters'

// red circular badge overlaid on a confirm-modal avatar header; positioning
// comes from the caller since each modal offsets it differently
const AvatarBadge = (props: {
  icon: Kb.IconType
  style?: Kb.Styles.StylesCrossPlatform
  iconStyle?: Kb.Styles.StylesCrossPlatform
}) => (
  <Kb.Box2
    direction="horizontal"
    centerChildren={true}
    overflow="hidden"
    style={Kb.Styles.collapseStyles([styles.badge, props.style])}
  >
    <Kb.Icon type={props.icon} color={Kb.Styles.globalColors.white} fontSize={14} style={props.iconStyle} />
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  badge: {
    ...Kb.Styles.size(24),
    backgroundColor: Kb.Styles.globalColors.red,
    ...Kb.Styles.border(Kb.Styles.globalColors.white, 3, 12),
  },
}))

export default AvatarBadge
