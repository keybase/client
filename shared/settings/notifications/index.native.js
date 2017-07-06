// @flow
import React from 'react'
import {HeaderHoc, NativeScrollView} from '../../common-adapters/index.native'
import {globalStyles} from '../../styles'
import Notifications from './index.js'

import type {Props} from './index'

const MobileNotifications = (props: Props) =>
  <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Notifications {...props} />
  </NativeScrollView>

export default HeaderHoc(MobileNotifications)
