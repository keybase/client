import * as React from 'react'
import {Text} from '../../../../common-adapters'
import UserNotice from '../user-notice'
import {globalColors} from '../../../../styles'

type Props = {
  username: string
  onOpenOlderConversation: () => void
}

const ProfileResetNotice = ({username, onOpenOlderConversation}: Props) => (
  <UserNotice username={username} bgColor={globalColors.blueLighter2}>
    <Text type="BodySmallSemibold" negative={true} style={{color: globalColors.black_50}}>
      {username} reset their profile
    </Text>
    <Text
      type="BodySmallPrimaryLink"
      negative={true}
      style={{color: globalColors.black_50}}
      onClick={onOpenOlderConversation}
    >
      View older conversation
    </Text>
  </UserNotice>
)

export default ProfileResetNotice
