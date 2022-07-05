import * as React from 'react'
import {NameWithIcon} from '../../../../common-adapters'
import {Props} from '.'

const NameWithIconWrapper = (props: Props) => (
  <NameWithIcon
    editableIcon={props.canEditDescription}
    onEditIcon={() => props.onEditIcon()}
    size="big"
    teamname={props.teamname}
    title={props.title}
    metaOne={props.metaOne}
    metaTwo={props.metaTwo}
  />
)

export default NameWithIconWrapper
