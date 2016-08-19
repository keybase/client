// @flow
import React from 'react'
import {ClickableBox, Box, Text, Icon} from '../common-adapters/index'
import {globalStyles, globalMargins} from '../styles'
import type {Props} from './link-with-icon'

const LinkWithIcon = ({label, icon, color, onClick, style}: Props) => (
  <ClickableBox style={style} onClick={onClick}>
    <Box style={styleContainer}>
      <Icon style={{...styleIcon, color}} type={icon} />
      <Text style={{...styleLabel, color}} type='BodyPrimaryLink'>{label}</Text>
    </Box>
  </ClickableBox>
)

const styleContainer = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
}

const styleIcon = {
  marginRight: globalMargins.xtiny,
  marginTop: 4,
}

const styleLabel = {
  flex: -1,
  textAlign: 'center',
}

export default LinkWithIcon
