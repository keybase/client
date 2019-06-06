import * as React from 'react'
import {Text, Icon} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {Props} from '.'

const LinkWithIcon = ({label, icon, color, onClick, style}: Props) => (
  <Text style={{...styleLabel, color, ...style}} type="BodyPrimaryLink" onClick={onClick}>
    <Icon style={styleIcon} type={icon} color={color} />
    {label}
  </Text>
)

const styleLabel = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
} as const

const styleIcon = {
  marginRight: globalMargins.tiny,
}

export default LinkWithIcon
