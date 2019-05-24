import * as React from 'react'
import {HeaderHoc, NativeScrollView} from '../../common-adapters/mobile.native'
import {globalStyles} from '../../styles'
import Notifications from './render'
import TurnOnNotifications from './turn-on-notifications.native'

import {Props} from '.'

const MobileNotifications = (props: Props) => (
  <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
    {!props.mobileHasPermissions && <TurnOnNotifications />}
    <Notifications {...props} />
  </NativeScrollView>
)

export default HeaderHoc(MobileNotifications)
