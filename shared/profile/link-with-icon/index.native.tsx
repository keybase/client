import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Props} from '.'

const LinkWithIcon = ({label, icon, color, onClick, style}: Props) => (
  <Kb.ClickableBox style={style} onClick={onClick}>
    <Kb.Box style={styleContainer}>
      <Kb.Icon style={styleIcon} type={Kb.Icon.makeFastType(icon)} color={color} />
      <Kb.Text center={true} style={{...styleLabel, color}} type="BodyPrimaryLink">
        {label}
      </Kb.Text>
    </Kb.Box>
  </Kb.ClickableBox>
)

const styleContainer = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
}

const styleIcon = {
  marginRight: Styles.globalMargins.tiny,
}

const styleLabel = {flex: -1}

export default LinkWithIcon
