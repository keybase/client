// @flow
import * as React from 'react'
import {Box, ClickableBox, Avatar, Text, Usernames} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../../styles'

type Props = {
  onShowProfile: (user: string) => void,
  participants: Array<{
    username: string,
    following: boolean,
    fullname: string,
    broken: boolean,
    isYou: boolean,
  }>,
}

const Participants = ({participants, onShowProfile}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, paddingTop: globalMargins.tiny}}>
    {participants.map(info => {
      const {username, following, fullname, broken, isYou} = info
      return (
        <ClickableBox key={username} onClick={() => onShowProfile(username)}>
          <Box style={isMobile ? rowStyleMobile : rowStyle}>
            <Box
              style={{
                ...globalStyles.flexBoxRow,
                alignItems: 'center',
                flex: 1,
                marginRight: globalMargins.tiny,
              }}
            >
              <Avatar size={isMobile ? 40 : 32} username={username} />
              <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
                <Usernames
                  colorFollowing={true}
                  type="BodySemibold"
                  users={[{broken, following, username, you: isYou}]}
                />
                {fullname !== '' && <Text type="BodySmall">{fullname}</Text>}
              </Box>
            </Box>
          </Box>
        </ClickableBox>
      )
    })}
  </Box>
)

type ParticipantProps = {
  onShowProfile: (user: string) => void,
  participant: {
    username: string,
    following: boolean,
    fullname: string,
    broken: boolean,
    isYou: boolean,
  },
}

const RenderParticipant = ({
  participant: {username, following, fullname, broken, isYou},
  onShowProfile,
}: ParticipantProps) => (
  <Box style={{...globalStyles.flexBoxColumn, paddingTop: globalMargins.tiny}}>
    <ClickableBox key={username} onClick={() => onShowProfile(username)}>
      <Box style={isMobile ? rowStyleMobile : rowStyle}>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'center',
            flex: 1,
            marginRight: globalMargins.tiny,
          }}
        >
          <Avatar size={isMobile ? 40 : 32} username={username} />
          <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
            <Usernames
              colorFollowing={true}
              type="BodySemibold"
              users={[{broken, following, username, you: isYou}]}
            />
            {fullname !== '' && <Text type="BodySmall">{fullname}</Text>}
          </Box>
        </Box>
      </Box>
    </ClickableBox>
  </Box>
)

const rowStyle = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.clickable,
  minHeight: 48,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
}

const rowStyleMobile = {
  ...rowStyle,
  minHeight: 56,
}
export {RenderParticipant}
export default Participants
