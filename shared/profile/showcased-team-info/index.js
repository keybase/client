// @flow

import * as React from 'react'
import {Avatar, Box, Text, Icon, Button, PlatformIcon} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {formatMessage, formatConfirmButton} from './index.shared'
import {subtitle as platformSubtitle} from '../../util/platforms'
import {isMobile} from '../../constants/platform'
import PopupMenu, {ModalLessPopupMenu} from '../../common-adapters/popup-menu'

import type {Props} from './index'

const TeamInfo = (props: Props) => {
  return <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
    <Avatar teamname={props.teamname} size={40} style={{marginTop: globalMargins.small}} />

    <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xtiny}}>
      <Text type='BodySemibold'>{props.teamname}</Text>
    </Box>

    <Text style={{color: globalColors.black_20, fontSize: 11, textTransform: 'uppercase'}} type='Body'>TEAM</Text>

    <Text style={{color: globalColors.black_20, fontSize: 11}} type='Body'>{props.memberCount} members</Text>

    <Box style={{...globalStyles.flexBoxRow, marginBottom: globalMargins.tiny, marginLeft: globalMargins.small, marginRight: globalMargins.small, marginTop: globalMargins.tiny}}>
      <Text style={{color: globalColors.black_20, fontSize: 11}} type='Body'>{props.description}</Text>
    </Box>

    <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
      <Button label='Join team' style={{marginTop: globalStyles.small}} type='Primary' />
    </Box>
  </Box>
}

const TeamInfoWrapper = (props: Props) => {
  const header = {
    title: 'header',
    view: <TeamInfo {...(props: Props)} />,
  }
  let items = []
  
  console.warn('in Revoke render')
  return (isMobile ? <PopupMenu style={{overflow: 'visible', width: 220}} header={header} items={items} /> : <ModalLessPopupMenu style={{overflow: 'visible', width: 220}} header={header} items={items} />)
}

export default TeamInfoWrapper
