import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {InlineDropdown} from '../../common-adapters/dropdown'
import {TeamRoleType} from '../../constants/types/teams'
import {roleIconMap} from '../role-picker'
import capitalize from 'lodash/capitalize'

export type Props = {
  selectedRole: TeamRoleType
  onClick: () => void
}

const RoleButton = (props: Props) => {
  const iconType = roleIconMap[props.selectedRole]

  return (
    <InlineDropdown
      type="BodySmallSemibold"
      label={
        <Kb.Box2 direction="horizontal" alignItems="center" style={styles.label}>
          <Kb.Icon type={iconType} style={styles.icon} sizeType="Small" />
          {capitalize(props.selectedRole)}
        </Kb.Box2>
      }
      onPress={props.onClick}
      style={styles.button}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  button: Styles.platformStyles({
    isElectron: {
      minHeight: 26,
      minWidth: 80,
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
