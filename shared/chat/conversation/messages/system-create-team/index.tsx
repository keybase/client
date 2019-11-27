import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import UserNotice from '../user-notice'

type Props = {
  creator: string
  team: string
  you: string
  isAdmin: boolean
  onViewTeam: () => void
}

const ManageComponent = (props: Props) => {
  const textType = 'BodySmallSemiboldPrimaryLink'
  if (props.isAdmin) {
    return (
      <Kb.Text onClick={props.onViewTeam} type={textType}>
        Manage team
      </Kb.Text>
    )
  } else {
    return null
  }
}

const youOrUsername = (props: {creator: string; you: string}) => (props.creator === props.you ? 'You ' : '')

const CreateTeam = (props: Props) => (
  <UserNotice>
    <Kb.Text type="BodySmall">
      {youOrUsername(props)}created the team <Kb.Text type="BodySmallBold">{props.team}</Kb.Text>
    </Kb.Text>
    <ManageComponent {...props} />
  </UserNotice>
)

export default CreateTeam
