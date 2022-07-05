import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Notifications from './render'
import TurnOnNotifications from './turn-on-notifications.native'
import {Props} from '.'

const MobileNotifications = (props: Props) => (
  <Kb.ScrollView style={{...Styles.globalStyles.flexBoxColumn, flex: 1}}>
    {!props.mobileHasPermissions && <TurnOnNotifications />}
    <Notifications {...props} />
  </Kb.ScrollView>
)

export default MobileNotifications
