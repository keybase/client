// @flow
import React from 'react'
import {Box, Divider} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'
import Participants from './participants.desktop'

import type {Props} from '.'

const border = `1px solid ${globalColors.black_05}`
const SidePanel = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1, borderLeft: border, borderRight: border, backgroundColor: globalColors.white, marginTop: -1}}>
    <Participants {...props} />
    <Divider style={{marginTop: 20, marginBottom: 20}} />
  </Box>
)

export default SidePanel
