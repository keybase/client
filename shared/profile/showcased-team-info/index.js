// @flow

import * as React from 'react'
import {Avatar, Box, Button, Divider, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'
import PopupMenu, {ModalLessPopupMenu} from '../../common-adapters/popup-menu'

import type {Props} from './index'

const TeamInfo = (props: Props) => {
  console.warn('youAreInTeam is', props.youAreInTeam)

  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Avatar
        teamname={props.teamname}
        size={40}
        style={{marginTop: globalMargins.small, marginBottom: globalMargins.small}}
      />

      <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xtiny}}>
        <Text type="BodySemibold">{props.teamname}</Text>
      </Box>

      <Text style={{color: globalColors.black_20, fontSize: 11, textTransform: 'uppercase'}} type="Body">
        {props.openTeam && 'OPEN '}TEAM
      </Text>

      <Text style={{color: globalColors.black_20, fontSize: 11}} type="Body">
        {props.memberCount} members
      </Text>

      <Box
        style={{
          ...globalStyles.flexBoxRow,
          marginBottom: globalMargins.tiny,
          marginLeft: globalMargins.small,
          marginRight: globalMargins.small,
          marginTop: globalMargins.tiny,
        }}
      >
        <Text style={{color: globalColors.black_20, fontSize: 11}} type="Body">{props.description}</Text>
      </Box>

      {props.teamJoinError && <Text style={{padding: globalMargins.small}} type="BodySmall">Error: {props.teamJoinError}</Text>}

      {!props.youAreInTeam &&
        <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
          <Button
            onClick={props.onJoinTeam}
            label={props.teamJoinSuccess ? 'Request sent' : props.openTeam ? 'Join team' : 'Request to join'}
            style={{marginTop: globalStyles.small}}
            type={props.teamJoinSuccess ? 'Secondary' : props.openTeam ? 'Following' : 'Primary'}
          />
        </Box>}
      
      <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
        <Divider />
      </Box>

      <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
        <Text type='Body'>foo</Text>
      </Box>
    </Box>
  )
}

const TeamInfoWrapper = (props: Props) => {
  const header = {
    title: 'header',
    view: <TeamInfo {...(props: Props)} />,
  }
  let items = []

  return isMobile
    ? <PopupMenu onHidden={props.onHidden} style={{overflow: 'visible'}} header={header} items={items} />
    : <ModalLessPopupMenu style={{overflow: 'visible', width: 220}} header={header} items={items} />
}

export default TeamInfoWrapper
