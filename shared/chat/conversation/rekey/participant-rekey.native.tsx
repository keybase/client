import * as React from 'react'
import {
  Box,
  Avatar,
  Usernames,
  Text,
  NativeScrollView,
  HeaderHoc,
  ClickableBox,
} from '../../../common-adapters/mobile.native'
import {globalColors, globalStyles, globalMargins, desktopStyles} from '../../../styles'
import {Props} from './participant-rekey.types'

const Row = ({username, onUsernameClicked}) => (
  <ClickableBox onClick={() => onUsernameClicked(username)}>
    <Box style={rowStyle}>
      <Avatar username={username} size={48} style={{marginRight: globalMargins.small, padding: 4}} />
      <Box style={innerRowStyle}>
        <Usernames inline={true} backgroundMode="Terminal" type="BodySemibold" users={[{username}]} />
        <Text
          type="BodySmall"
          negative={true}
          style={{color: globalColors.blueLighter_40, lineHeight: 17} as any}
        >
          Can rekey this chat by opening the Keybase app.
        </Text>
      </Box>
    </Box>
  </ClickableBox>
)

const ParticipantRekey = ({rekeyers, onShowProfile: onUsernameClicked}: Props) => (
  <Box style={containerStyle}>
    <Box style={{...globalStyles.flexBoxRow, backgroundColor: globalColors.red, justifyContent: 'center'}}>
      <Text
        center={true}
        negative={true}
        style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
        type="BodySemibold"
      >
        This conversation is waiting for a participant to open their Keybase app.
      </Text>
    </Box>
    <NativeScrollView style={{flex: 1, paddingTop: 8}}>
      <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', marginLeft: 8}}>
        <Box>
          {rekeyers.map(username => (
            <Row key={username} username={username} onUsernameClicked={onUsernameClicked} />
          ))}
        </Box>
      </Box>
    </NativeScrollView>
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  backgroundColor: globalColors.blueDarker2,
  flex: 1,
  justifyContent: 'flex-start',
}

const rowStyle = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  alignItems: 'center',
  minHeight: 56,
}

const innerRowStyle = {
  ...globalStyles.flexBoxColumn,
  borderBottomColor: globalColors.black_10,
  borderBottomWidth: 1,
  flex: 1,
  justifyContent: 'center',
  minHeight: 56,
}

export default HeaderHoc(ParticipantRekey)
