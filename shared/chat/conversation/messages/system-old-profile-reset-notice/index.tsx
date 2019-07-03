import * as React from 'react'
import {Text} from '../../../../common-adapters'
import UserNotice from '../user-notice'
import {globalColors, globalMargins} from '../../../../styles'

type Props = {
  username: string
  onOpenNewerConversation: () => void
}

const OldProfileResetNotice = ({username, onOpenNewerConversation}: Props) => (
  <UserNotice style={{marginBottom: globalMargins.small}} username={username} bgColor={globalColors.red}>
    <Text type="BodySmallSemibold" negative={true}>
      {username} reset their profile
    </Text>
    <Text type="BodySmall" negative={true}>
      Their encryption keys were replaced with new ones.
    </Text>
    <Text type="BodySmallPrimaryLink" negative={true} onClick={onOpenNewerConversation}>
      Jump to new conversation
    </Text>
  </UserNotice>
)

export default OldProfileResetNotice
