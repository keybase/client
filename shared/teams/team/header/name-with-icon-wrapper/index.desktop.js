// @flow
import * as React from 'react'
import {NameWithIcon} from '../../../../common-adapters'
import type {Props} from '.'

const NameWithIconWrapper = (props: Props) => (
  <NameWithIcon
    editableIcon={props.canEditDescription}
    onEditIcon={() => props.onEditIcon()}
    size="large"
    teamname={props.teamname}
    title={props.teamname}
    metaOne={props.metaOne}
    metaTwo={props.metaTwo}
  />
)

export default NameWithIconWrapper
