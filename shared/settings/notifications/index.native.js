// @flow
import * as React from 'react'
import {HeaderHoc, NativeScrollView} from '../../common-adapters/native'
import {globalStyles} from '../../styles'
import Notifications from './index.js'
import TurnOnNotifications from './turn-on-notifications.native'

import type {Props} from './index'

const MobileNotifications = (props: Props) => (
  <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
    {!props.mobileHasPermissions && <TurnOnNotifications />}
    <Notifications {...props} />
  </NativeScrollView>
)

export default HeaderHoc(MobileNotifications)
