// @flow
import React from 'react'
import {Text, Icon} from '../common-adapters'
import {globalMargins, globalStyles} from '../styles'
import type {Props} from './link-with-icon'

const LinkWithIcon = ({label, icon, color, onClick, style}: Props) => (
  <Text style={{...styleLabel, color, ...style}} type="BodyPrimaryLink" onClick={onClick}>
    <Icon style={{...styleIcon, color}} type={icon} />{label}
  </Text>
)

const styleLabel = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const styleIcon = {
  marginRight: globalMargins.tiny,
}

export default LinkWithIcon
