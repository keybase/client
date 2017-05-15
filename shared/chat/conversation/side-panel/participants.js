// @flow
import React from 'react'
import {List} from 'immutable'
import {Box, ClickableBox, Avatar, Text, Usernames, Divider, Icon} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'

type Props = {
  onAddParticipant: () => void,
  onShowProfile: (user: string) => void,
  participants: List<{
    username: string,
    following: boolean,
    fullname: string,
    broken: boolean,
    isYou: boolean,
  }>,
  style?: ?Object,
}

const Participants = ({participants, onShowProfile, onAddParticipant, style}: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      paddingTop: globalMargins.tiny,
      ...style,
    }}
  >
    {participants.map(info => {
      const {username, following, fullname, broken, isYou} = info
      return (
        <ClickableBox key={username} onClick={() => onShowProfile(username)}>
          <Box style={rowStyle}>
            <Box
              style={{
                ...globalStyles.flexBoxRow,
                alignItems: 'center',
                flex: 1,
                marginRight: globalMargins.tiny,
              }}
            >
              <Avatar size={32} username={username} />
              <Usernames
                colorFollowing={true}
                type="BodySemibold"
                users={[{username, you: isYou, following, broken}]}
                containerStyle={{marginLeft: 12}}
              />
              <Text
                type="BodySmall"
                style={{
                  marginLeft: globalMargins.tiny,
                  flex: 1,
                  textAlign: 'right',
                }}
              >
                {fullname}
              </Text>
            </Box>
            <Divider style={{marginLeft: 44}} />
          </Box>
        </ClickableBox>
      )
    })}
    <ClickableBox onClick={() => onAddParticipant()}>
      <Box style={{...rowStyle, ...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <Icon type="icon-user-add-32" style={{marginRight: 12}} />
        <Text type="BodyPrimaryLink" onClick={() => onAddParticipant()}>
          Add another participant
        </Text>
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
