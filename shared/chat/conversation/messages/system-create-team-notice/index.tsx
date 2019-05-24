import React from 'react'
import {Text} from '../../../../common-adapters'
import UserNotice from '../user-notice'
import {globalColors} from '../../../../styles'

type Props = {
  onShowNewTeamDialog: () => void
}

const CreateTeamNotice = ({onShowNewTeamDialog}: Props) => (
  <UserNotice username="" bgColor={globalColors.blueLighter2}>
    <Text type="BodySmallSemibold" center={true}>
      Make it a team? You'll be able to add and delete members as you wish.{' '}
      <Text
        type="BodySmallPrimaryLink"
        className="hover-underline"
        style={{fontWeight: '600'}}
        onClick={onShowNewTeamDialog}
      >
        Enter a team name
      </Text>
    </Text>
  </UserNotice>
)

export default CreateTeamNotice
