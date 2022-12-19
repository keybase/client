import * as TeamsGen from '../../../../../actions/teams-gen'
import * as Constants from '../../../../../constants/teams'
import * as Container from '../../../../../util/container'
import {TeamInviteRow} from '.'
import type {InviteInfo, TeamID} from '../../../../../constants/types/teams'
import {formatPhoneNumber} from '../../../../../util/phone-numbers'

type OwnProps = {
  id: string
  teamID: TeamID
  firstItem: boolean
}

/**
 * labelledInviteRegex matches a string like "Jakob (+1 (216) 555-3434)" or "Max (max@keybase.io)"
 * The ? in the first group is so that it doesn't treat "216) 555-3434" as the parenthesized bit in the first case above.
 */
const labelledInviteRegex = /^(.+?) \((.+)\)$/

// TODO: when removing flags.teamsRedesign, move this into the component itself
export default Container.connect(
  (state, {teamID}: OwnProps) => {
    const teamDetails = Constants.getTeamDetails(state, teamID)
    return {_invites: teamDetails.invites}
  },
  (dispatch, {teamID}: OwnProps) => ({
    _onCancelInvite: (inviteID: string) => {
      dispatch(TeamsGen.createRemovePendingInvite({inviteID, teamID}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const user: InviteInfo | undefined =
      [...(stateProps._invites || [])].find(invite => invite.id === ownProps.id) || Constants.emptyInviteInfo
    if (!user) {
      // loading
      return {firstItem: ownProps.firstItem, label: '', onCancelInvite: () => {}, role: 'reader'} as const
    }
    const onCancelInvite = () => dispatchProps._onCancelInvite(ownProps.id)

    let label = user.username || user.name || user.email || user.phone
    let subLabel = user.name ? user.phone || user.email : undefined
    if (!subLabel && labelledInviteRegex.test(label)) {
      const match = labelledInviteRegex.exec(label)!
      label = match[1]
      subLabel = match[2]
    }
    try {
      label = label === user.phone ? formatPhoneNumber('+' + label) : label
      subLabel = subLabel === user.phone ? formatPhoneNumber('+' + subLabel) : subLabel
    } catch {}

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
