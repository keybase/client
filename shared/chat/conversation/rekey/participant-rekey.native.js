// @flow
import React from 'react'
import {
  Box,
  Avatar,
  Usernames,
  Text,
  NativeScrollView,
  HeaderHoc,
  ClickableBox,
} from '../../../common-adapters/index.native'
import {globalColors, globalStyles} from '../../../styles'

import type {Props} from './participant-rekey'

const Row = ({username, onUsernameClicked}) => (
  <ClickableBox onClick={() => onUsernameClicked(username)}>
    <Box style={rowStyle}>
      <Avatar
        username={username}
        size={40}
        style={{marginRight: 12, padding: 4}}
      />
      <Box style={innerRowStyle}>
        <Usernames
          inline={true}
          backgroundMode="Terminal"
          type="BodySemibold"
          users={[{username}]}
        />
        <Text
          type="BodySmall"
          backgroundMode="Terminal"
          style={{lineHeight: 17, color: globalColors.blue3_40}}
        >
          Can rekey this chat by opening the Keybase app.
        </Text>
      </Box>
    </Box>
  </ClickableBox>
)

const ParticipantRekey = ({
  rekeyInfo,
  onShowProfile: onUsernameClicked,
}: Props) => (
  <Box style={containerStyle}>
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        backgroundColor: globalColors.red,
        justifyContent: 'center',
      }}
    >
      <Text
        backgroundMode="Terminal"
        style={{
          paddingBottom: 8,
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 8,
        }}
        type="BodySemibold"
      >
        This conversation is waiting for a participant to open their Keybase app.
      </Text>
    </Box>
    <NativeScrollView style={{flex: 1, paddingTop: 8}}>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          justifyContent: 'center',
          marginLeft: 8,
        }}
      >
        <Box>
          {!!rekeyInfo &&
            rekeyInfo
              .get('rekeyParticipants')
              .map(username => (
                <Row
                  key={username}
                  username={username}
                  onUsernameClicked={onUsernameClicked}
                />
              ))}
        </Box>
      </Box>
    </NativeScrollView>
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  backgroundColor: globalColors.darkBlue4,
  borderLeft: `1px solid ${globalColors.black_20}`,
  flex: 1,
  justifyContent: 'flex-start',
}

const rowStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  minHeight: 56,
  alignItems: 'center',
}

const innerRowStyle = {
  ...globalStyles.flexBoxColumn,
  borderBottomWidth: 1,
  borderBottomColor: globalColors.black_10,
  flex: 1,
  minHeight: 56,
  justifyContent: 'center',
}

export default HeaderHoc(ParticipantRekey)
