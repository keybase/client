// @flow
import * as React from 'react'
import {Box, Text, Icon, Button} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  allowChatWithoutThem: boolean,
  username: string,
  viewProfile: () => void,
  chatWithoutThem: () => void,
  letThemIn: () => void,
}

const ResetUser = ({username, viewProfile, letThemIn, allowChatWithoutThem, chatWithoutThem}: Props) => (
  <Box style={containerStyle}>
    <Icon
      type={isMobile ? 'icon-skull-64' : 'icon-skull-48'}
      style={{height: 64, margin: globalMargins.medium}}
    />
    <Box style={textContainerStyle}>
      <Text center={true} type="BodySemibold" backgroundMode="Terminal">
        <Text type="BodySemiboldLink" backgroundMode="Terminal" onClick={viewProfile}>
          {username}{' '}
        </Text>
        <Text type="BodySemibold" backgroundMode="Terminal">
          lost all their devices and this account has new keys. If you want to let them into this chat and
          folder's history, you should either:
        </Text>
      </Text>
      <Box style={bulletStyle}>
        <Text type="BodySemibold" backgroundMode="Terminal" style={{marginTop: globalMargins.tiny}}>
          1. Be satisfied with their new proofs, or
        </Text>
        <Text type="BodySemibold" backgroundMode="Terminal" style={{marginTop: globalMargins.tiny}}>
          2. Know them outside Keybase and have gotten a thumbs up from them.
        </Text>
      </Box>
      <Text type="BodySemibold" backgroundMode="Terminal" style={{marginTop: globalMargins.tiny}}>
        Don't let them in until one of those is true.
      </Text>
      <Box
        style={{
          marginBottom: globalMargins.medium,
          marginTop: globalMargins.medium,
          ...globalStyles.flexBoxRow,
        }}
      >
        <Button
          type="Secondary"
          backgroundMode="Terminal"
          onClick={viewProfile}
          label="View profile"
          style={{backgroundColor: globalColors.black_20, marginRight: 8}}
        />
        <Button
          type="Secondary"
          backgroundMode="Terminal"
          onClick={letThemIn}
          label="Let them in"
          labelStyle={{color: globalColors.red}}
          style={{backgroundColor: globalColors.white}}
        />
      </Box>
      {allowChatWithoutThem && (
        <Text type="BodySemibold" backgroundMode="Terminal">
          Or until you’re sure,{' '}
          <Text type="BodySemiboldLink" backgroundMode="Terminal" onClick={chatWithoutThem}>
            chat without them
          </Text>
        </Text>
      )}
    </Box>
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.red,
  padding: globalMargins.small,
}

const textContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingLeft: 64,
  paddingRight: 64,
}

const bulletStyle = {
  ...globalStyles.flexBoxColumn,
  maxWidth: 250,
}

export default ResetUser
