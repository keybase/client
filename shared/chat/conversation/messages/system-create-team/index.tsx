import * as Kb from '../../../../common-adapters'
import type * as TeamsTypes from '../../../../constants/types/teams'
import UserNotice from '../user-notice'
import * as Container from '../../../../util/container'
import * as TeamsGen from '../../../../actions/teams-gen'

type Props = {
  creator: string
  team: string
  teamID: TeamsTypes.TeamID
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
  const dispatch = Container.useDispatch()
  const onAddInvite = () => dispatch(TeamsGen.createStartAddMembersWizard({teamID: props.teamID}))
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
