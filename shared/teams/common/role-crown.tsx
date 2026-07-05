import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import type {SizeType} from '@/common-adapters/icon'

// crown icon shown next to admins (grey) and owners (yellow); renders nothing for other roles
const RoleCrown = (props: {
  role: T.Teams.TeamRoleType
  fontSize?: number
  sizeType?: SizeType
  style?: Kb.Styles.StylesCrossPlatform
}) =>
  props.role === 'admin' || props.role === 'owner' ? (
    <Kb.Icon
      type={props.role === 'owner' ? 'iconfont-crown-owner' : 'iconfont-crown-admin'}
      color={
        props.role === 'owner' ? Kb.Styles.globalColors.yellowDark : Kb.Styles.globalColors.black_35
      }
      fontSize={props.fontSize}
      sizeType={props.sizeType}
      style={props.style}
    />
  ) : null

export default RoleCrown
