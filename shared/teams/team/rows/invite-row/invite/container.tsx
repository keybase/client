import * as TeamsGen from '../../../../../actions/teams-gen'
import * as Constants from '../../../../../constants/teams'
import * as Container from '../../../../../util/container'
import {TeamInviteRow} from '.'
import {InviteInfo, TeamID} from '../../../../../constants/types/teams'
import {Contact} from '../../../../invite-by-contact'

type OwnProps = {
  id: string
  teamID: TeamID
  firstItem: boolean
  contacts: Contact[] | null
}

// TODO: when removing flags.teamsRedesign, move this into the component itself
export default Container.connect(
  (state, {teamID}: OwnProps) => {
    const teamDetails = Constants.getTeamDetails(state, teamID)
    return {_invites: teamDetails.invites}
  },
  (dispatch, {teamID}: OwnProps) => ({
    _onCancelInvite: ({
      email,
      username,
      inviteID,
    }: {
      email?: string
      username?: string
      inviteID?: string
    }) => {
      dispatch(TeamsGen.createRemovePendingInvite({email, inviteID, teamID, username}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const user: InviteInfo | undefined =
      [...(stateProps._invites || [])].find(invite => invite.id === ownProps.id) || Constants.emptyInviteInfo
    if (!user) {
      // loading
      return {firstItem: ownProps.firstItem, label: '', onCancelInvite: () => {}, role: 'reader'} as const
    }
    let onCancelInvite: undefined | (() => void)
    if (user.email) {
      onCancelInvite = () =>
        dispatchProps._onCancelInvite({
          email: user.email,
        })
    } else if (user.username) {
      onCancelInvite = () =>
        dispatchProps._onCancelInvite({
          username: user.username,
        })
    } else if (user.name || user.phone) {
      onCancelInvite = () =>
        dispatchProps._onCancelInvite({
          inviteID: ownProps.id,
        })
    }
    // TODO: can we just do this by invite ID always?

    // First, maybe we have both a name and a phone/email
    let label = user.username || user.name || user.email || user.phone
    let subLabel = user.name ? user.phone || user.email : undefined

    // Or maybe it's all in the invite name
    const re = /^(.+?) \((.+)\)$/
    if (!subLabel && re.test(label)) {
      const match = re.exec(label)!
      label = match[1]
      subLabel = match[2]
    }

    // Or maybe we could get a name from our contacts
    if (!subLabel && ownProps.contacts) {
      const contact = ownProps.contacts.find(c => c.value === label)
      if (contact?.name) {
        subLabel = label
        label = contact.name
      }
    }

    return {
      firstItem: ownProps.firstItem,
      isKeybaseUser: !!user.username,
      label,
      onCancelInvite,
      role: user.role,
      subLabel,
    }
  }
)(TeamInviteRow)
