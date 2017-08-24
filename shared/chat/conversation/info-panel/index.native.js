// @flow
import * as React from 'react'
import {HeaderHoc, ScrollView} from '../../../common-adapters/index.native'

import InfoPanelContents from './index.shared'

import type {Props} from '.'

const InfoPanelContainer = (props: Props) => (
  <ScrollView style={{flex: 1, width: '100%'}}>
    <InfoPanelContents {...props} />
  </ScrollView>
)

const InfoPanel = HeaderHoc(InfoPanelContainer)

export default InfoPanel
