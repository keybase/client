import * as Kb from '@/common-adapters'
import {InlineDropdown} from '@/common-adapters/dropdown'
import type * as T from '@/constants/types'
import capitalize from 'lodash/capitalize'

export type Props = {
  containerStyle?: Kb.Styles.StylesCrossPlatform
  selectedRole: T.Teams.TeamRoleType
  onClick: () => void
  style?: Kb.Styles.StylesCrossPlatform
  loading?: boolean
}

const roleIconMap = {
  admin: 'iconfont-crown-admin',
  bot: undefined,
  owner: 'iconfont-crown-owner',
  reader: undefined,
  restrictedbot: undefined,
  writer: undefined,
} as const

const RoleButton = (props: Props) => {
  const iconType = roleIconMap[props.selectedRole]

  return (
    <InlineDropdown
      containerStyle={props.containerStyle}
      textWrapperType={null}
      label={
        <Kb.Box2 direction="horizontal" alignItems="center" style={styles.label}>
          {iconType ? <Kb.Icon type={iconType} style={styles.icon} sizeType="Small" /> : null}
          <Kb.Text type="BodySmallSemibold">{capitalize(props.selectedRole)}</Kb.Text>
        </Kb.Box2>
      }
      onPress={props.onClick}
      style={Kb.Styles.collapseStyles([styles.button, props.style])}
      loading={props.loading}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  button: Kb.Styles.platformStyles({
    common: {
      marginRight: 0,
    },
    isElectron: {
      minHeight: 26,
      minWidth: 82,
    },
    isMobile: {
      minHeight: 30,
      minWidth: 100,
    },
  }),
  icon: {
    alignSelf: 'center',
    marginLeft: 0,
    marginRight: Kb.Styles.globalMargins.xtiny,
  },
  label: {
    marginLeft: Kb.Styles.globalMargins.xtiny,
  },
}))

export default RoleButton
