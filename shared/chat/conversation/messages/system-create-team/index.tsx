import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import type * as T from '@/constants/types'

type Props = {
  creator: string
  team: string
  teamID: T.Teams.TeamID
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
const AddInvite = (props: Props) => {
  const startAddMembersWizard = C.useTeamsState(s => s.dispatch.startAddMembersWizard)
  const onAddInvite = () => startAddMembersWizard(props.teamID)
  const textType = 'BodySmallSemiboldPrimaryLink'
  if (props.isAdmin) {
    return (
      <Kb.Text onClick={onAddInvite} type={textType}>
        Add/invite people
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
      {youOrUsername(props)}created the team <Kb.Text type="BodySmallBold">{props.team}</Kb.Text>.
    </Kb.Text>
    <ManageComponent {...props} />
    <AddInvite {...props} />
  </UserNotice>
)

export default CreateTeam
