// @flow
import * as React from 'react'
import {Box, ClickableBox, Avatar, Text, Usernames} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'

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
  </Box>
)

const rowStyle = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.clickable,
  minHeight: 40,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
}

const rowStyleMobile = {
  ...rowStyle,
  minHeight: 56,
}

export default Participants
