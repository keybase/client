// @flow
import * as React from 'react'
import {Box, Text, Icon, Button} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../../styles'

type Props = {
  allowChatWithoutThem: boolean,
  username: string,
  viewProfile: () => void,
  chatWithoutThem: () => void,
  letThemIn: () => void,
}

const ResetUser = ({username, viewProfile, letThemIn, allowChatWithoutThem, chatWithoutThem}: Props) => (
  <Box style={containerStyle}>
    <Icon type="icon-skull-64" style={{margin: globalMargins.medium}} />
    <Box style={textContainerStyle}>
      <Text type="BodySemibold" backgroundMode="Terminal" style={{textAlign: 'center'}}>
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
          marginTop: globalMargins.medium,
          marginBottom: globalMargins.medium,
          ...globalStyles.flexBoxRow,
        }}
      >
        <Button
          type="Secondary"
          backgroundMode="Terminal"
          onClick={viewProfile}
          label="View profile"
          style={{marginRight: 8, backgroundColor: globalColors.black_20}}
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
  maxWidth: 280,
  alignItems: 'center',
}

const bulletStyle = {
  ...globalStyles.flexBoxColumn,
  maxWidth: 250,
}

export default ResetUser
