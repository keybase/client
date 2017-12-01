// @flow

import * as React from 'react'
import {Avatar, Box, Text, Icon, Button, PlatformIcon} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {formatMessage, formatConfirmButton} from './index.shared'
import {subtitle as platformSubtitle} from '../../util/platforms'
import {isMobile} from '../../constants/platform'
import {ModalLessPopupMenu as PopupMenu} from '../../common-adapters/popup-menu.desktop'

import type {Props} from './index'

const TeamInfo = (props: Props) => {
  console.warn('isWaiting 2 is', props)
  return <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
    <Avatar teamname={props.teamname} size={40} style={{marginTop: globalMargins.small}} />

    <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xtiny}}>
      <Text type='BodySemibold'>{props.teamname}</Text>
    </Box>

    <Text style={{color: globalColors.black_20, fontSize: 11, textTransform: 'uppercase'}} type='Body'>OPEN TEAM</Text>

    <Text style={{color: globalColors.black_20, fontSize: 11}} type='Body'>{props.members} members</Text>

    <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xtiny}}>
      <Text style={{marginBottom: globalStyles.small, marginTop: globalStyles.small, color: globalColors.black_20, fontSize: 11}} type='Body'>description {props.description}</Text>
    </Box>

    <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
      <Button label='Join team' style={{marginTop: globalStyles.small}} type='Primary' />
    </Box>
  </Box>
}

const Revoke = (props: Props) => {
  console.warn('isWaiting is', props)
  const header = {
    title: 'header',
    view: <TeamInfo {...(props: Props)} />,
  }
  let items = []
  
  console.warn('in Revoke render')
  return (
    <PopupMenu style={{overflow: 'visible', width: 220}} header={header} items={items} />
  )
}

export default Revoke
