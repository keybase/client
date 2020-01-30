import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Props} from '.'

const LinkWithIcon = ({label, icon, color, onClick, style}: Props) => (
  <Kb.Text style={{...styleLabel, color, ...style}} type="BodyPrimaryLink" onClick={onClick}>
    <Kb.Icon style={styleIcon} type={Kb.Icon.makeFastType(icon)} color={color} />
    {label}
  </Kb.Text>
)

const styleLabel = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
} as const

const styleIcon = {
  marginRight: Styles.globalMargins.tiny,
}

export default LinkWithIcon
