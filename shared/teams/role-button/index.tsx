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
      type="BodySmall"
      label={
        <Kb.Box2 direction="horizontal" alignItems="center" style={styles.label}>
          <Kb.Icon type={iconType} style={styles.icon} fontSize={Styles.isMobile ? 16 : 12} />
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
    marginBottom: Styles.globalMargins.tiny,
    marginLeft: 0,
    marginRight: Styles.globalMargins.xtiny,
    marginTop: Styles.globalMargins.tiny,
  },
  label: {
    marginLeft: Styles.globalMargins.xtiny,
  },
}))

export default RoleButton
