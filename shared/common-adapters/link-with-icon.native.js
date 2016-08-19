// @flow
import React from 'react'
import {NativeTouchableHighlight, Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import type {Props} from './link-with-icon'

const LinkWithIcon = ({label, icon, color, onClick, style}: Props) => (
  <NativeTouchableHighlight
    style={{...styleTouchable, ...style}}
    underlayColor={globalColors.black_10}
    onPress={onClick}>
    <Box style={styleContainer}>
      <Icon style={{...styleIcon, color}} type={icon} />
      <Text style={{...styleLabel, color}} type='BodyPrimaryLink'>{label}</Text>
    </Box>
  </NativeTouchableHighlight>
)

const styleTouchable = {
  borderRadius: 3,
}

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
