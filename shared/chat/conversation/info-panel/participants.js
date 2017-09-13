// @flow
import * as React from 'react'
import {Box, ClickableBox, Avatar, Text, Usernames, Icon} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'

type Props = {
  onAddParticipant: ?() => void,
  onShowProfile: (user: string) => void,
  participants: Array<{
    username: string,
    following: boolean,
    fullname: string,
    broken: boolean,
    isYou: boolean,
  }>,
}

const Participants = ({participants, onShowProfile, onAddParticipant}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, paddingTop: globalMargins.tiny}}>
    {participants.map((info, index, arr) => {
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
                users={[{broken, following, username, you: isYou}]}
                containerStyle={{marginLeft: 12}}
              />
              <Text type="BodySmall" style={{flex: 1, marginLeft: globalMargins.tiny, textAlign: 'right'}}>
                {fullname}
              </Text>
            </Box>
          </Box>
        </ClickableBox>
      )
    })}
    {onAddParticipant
      ? <ClickableBox onClick={onAddParticipant}>
          <Box style={{...rowStyle, ...globalStyles.flexBoxRow, alignItems: 'center'}}>
            <Icon type="icon-user-add-32" style={{marginRight: 12}} />
            <Text type="BodyPrimaryLink" onClick={onAddParticipant}>Add another participant</Text>
          </Box>
        </ClickableBox>
      : null}
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
