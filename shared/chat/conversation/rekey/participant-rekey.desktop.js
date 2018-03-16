// @flow
import * as React from 'react'
import {Box, Avatar, Usernames, Text} from '../../../common-adapters'
import {globalColors, globalStyles, platformStyles, desktopStyles} from '../../../styles'

import type {Props} from './participant-rekey'

const Row = ({username, onUsernameClicked}) => (
  <Box style={rowStyle} onClick={() => onUsernameClicked(username)}>
    <Avatar username={username} size={40} style={{marginRight: 12, padding: 4}} />
    <Box style={innerRowStyle}>
      <Usernames inline={true} type="BodySemibold" users={[{username}]} />
      <Text type="BodySmall" style={platformStyles({isElectron: {lineHeight: '17px'}})}>
        Can rekey this chat by opening the Keybase app.
      </Text>
    </Box>
  </Box>
)

const ParticipantRekey = ({rekeyers, onShowProfile: onUsernameClicked}: Props) => {
  return (
    <Box style={containerStyle}>
      <Box style={{...globalStyles.flexBoxRow, backgroundColor: globalColors.red, justifyContent: 'center'}}>
        <Text
          backgroundMode="Terminal"
          style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
          type="BodySemibold"
        >
          This conversation is waiting for a participant to open their Keybase app.
        </Text>
      </Box>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          flex: 1,
          justifyContent: 'center',
          marginLeft: 8,
          overflow: 'auto',
        }}
      >
        <Box>
          {rekeyers.map(username => (
            <Row key={username} username={username} onUsernameClicked={onUsernameClicked} />
          ))}
        </Box>
      </Box>
    </Box>
  )
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  backgroundColor: globalColors.white,
  borderLeft: `1px solid ${globalColors.black_20}`,
  flex: 1,
  justifyContent: 'flex-start',
}

const rowStyle = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  minHeight: 48,
}

const innerRowStyle = {
  ...globalStyles.flexBoxColumn,
  borderBottom: `1px solid ${globalColors.black_10}`,
  flex: 1,
  justifyContent: 'center',
}

export default ParticipantRekey
