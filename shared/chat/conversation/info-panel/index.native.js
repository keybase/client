// @flow
import * as React from 'react'
import {HeaderHoc, NativeScrollView} from '../../../common-adapters/index.native'

import InfoPanelContents from './index.shared'

import type {Props} from '.'

const InfoPanelContainer = (props: Props) => (
  <NativeScrollView style={{flex: 1, width: '100%'}}>
    <InfoPanelContents {...props} />
  </NativeScrollView>
)

const InfoPanel = HeaderHoc(InfoPanelContainer)

export default InfoPanel
