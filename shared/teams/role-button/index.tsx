import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {InlineDropdown} from '../../common-adapters/dropdown'
import type {TeamRoleType} from '../../constants/types/teams'
import {roleIconMap} from '../role-picker'
import capitalize from 'lodash/capitalize'

export type Props = {
  containerStyle?: Styles.StylesCrossPlatform
  selectedRole: TeamRoleType
  onClick: () => void
  style?: Styles.StylesCrossPlatform
  loading?: boolean
}

const RoleButton = (props: Props) => {
  const iconType = roleIconMap[props.selectedRole]

  return (
    <InlineDropdown
      containerStyle={props.containerStyle}
      textWrapperType={null}
      label={
        <Kb.Box2 direction="horizontal" alignItems="center" style={styles.label}>
          <Kb.Icon type={iconType} style={styles.icon} sizeType="Small" />
          <Kb.Text type="BodySmallSemibold">{capitalize(props.selectedRole)}</Kb.Text>
        </Kb.Box2>
      }
      onPress={props.onClick}
      style={Styles.collapseStyles([styles.button, props.style])}
      loading={props.loading}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  button: Styles.platformStyles({
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
    marginRight: Styles.globalMargins.xtiny,
  },
  label: {
    marginLeft: Styles.globalMargins.xtiny,
  },
}))

export default RoleButton
