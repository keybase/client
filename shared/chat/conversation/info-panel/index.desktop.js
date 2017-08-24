// @flow
import * as React from 'react'
import {Box} from '../../../common-adapters'
import {globalColors} from '../../../styles'

import InfoPanelContents from './index.shared'

import type {Props} from '.'

const border = `1px solid ${globalColors.black_05}`
const InfoPanel = (props: Props) => (
  <Box
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
  </Box>
)

export default InfoPanel
