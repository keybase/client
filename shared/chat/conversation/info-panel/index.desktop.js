// @flow
import * as React from 'react'
import {ScrollView} from '../../../common-adapters'
import {globalColors} from '../../../styles'

import InfoPanelContents from './index.shared'

import type {Props} from '.'

const border = `1px solid ${globalColors.black_05}`
const InfoPanel = (props: Props) => (
  <ScrollView
    style={{
      backgroundColor: globalColors.white,
      borderLeft: border,
      borderRight: border,
      flex: 1,
      marginTop: -1,
      overflowY: 'auto',
    }}
  >
    <InfoPanelContents {...props} />
  </ScrollView>
)

export default InfoPanel
