// @flow
import * as React from 'react'
import {Box, ClickableBox, Avatar, Text, ConnectedUsernames} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile, desktopStyles, platformStyles} from '../../../styles'

type Props = {
  fullname: string,
  username: string,
  onShowProfile: (username: string) => void,
}

const Participant = ({fullname, username, onShowProfile}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, paddingTop: globalMargins.tiny}}>
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
          <Avatar size={isMobile ? 40 : 32} username={username} />
          <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
            <ConnectedUsernames colorFollowing={true} type="BodySemibold" usernames={[username]} />
            {fullname !== '' && <Text type="BodySmall">{fullname}</Text>}
          </Box>
        </Box>
      </Box>
    </ClickableBox>
  </Box>
)

const rowStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    minHeight: 48,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
  },
  isElectron: {
    ...desktopStyles.clickable,
  },
  isMobile: {
    minHeight: 56,
  },
})

export default Participant
