// @flow
import React from 'react'
import {Map} from 'immutable'
import {Box, ClickableBox, Avatar, Text, Usernames, Divider, Icon} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'

import type {Props} from '.'

const Participants = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, paddingTop: globalMargins.tiny}}>
    {props.participants.map(username => {
      const you = username === props.you
      const following = !!props.followingMap[username]
      const meta = props.metaDataMap.get(username, Map({}))
      const fullname = meta.get('fullname', 'Unknown')
      const broken = meta.get('brokenTracker', false)
      return (
        <ClickableBox key={username} onClick={() => props.onShowProfile(username)}>
          <Box style={rowStyle}>
            <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1, marginRight: globalMargins.tiny}}>
              <Avatar size={32} username={username} />
              <Usernames colorFollowing={true} type='BodySemibold' users={[{username, you, following, broken}]} containerStyle={{marginLeft: 12}} />
              <Text type='BodySmall' style={{marginLeft: globalMargins.tiny, flex: 1, textAlign: 'right'}}>{fullname}</Text>
            </Box>
            <Divider style={{marginLeft: 44}} />
          </Box>
        </ClickableBox>
      )
    })}
    <ClickableBox onClick={() => props.onAddParticipant()}>
      <Box style={{...rowStyle, ...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <Icon type='icon-user-add-32' style={{marginRight: 12}} />
        <Text type='BodyPrimaryLink' onClick={() => props.onAddParticipant()}>Add another participant</Text>
      </Box>
    </ClickableBox>
  </Box>
)

const rowStyle = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.clickable,
  minHeight: globalMargins.large,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
}

export default Participants
