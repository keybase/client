import * as TeamsGen from '../../../../../actions/teams-gen'
import * as Constants from '../../../../../constants/teams'
import * as Container from '../../../../../util/container'
import {TeamInviteRow} from '.'
import type {InviteInfo, TeamID, TeamRoleType} from '../../../../../constants/types/teams'
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
export default (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const teamDetails = Constants.useState(s => s.teamDetails.get(teamID))
  const _invites = teamDetails?.invites
  const dispatch = Container.useDispatch()
  const _onCancelInvite = (inviteID: string) => {
    dispatch(TeamsGen.createRemovePendingInvite({inviteID, teamID}))
  }

  const user: InviteInfo | undefined =
    [...(_invites ?? [])].find(invite => invite.id === ownProps.id) || Constants.emptyInviteInfo

  let label: string = ''
  let subLabel: undefined | string
  let role: TeamRoleType = 'reader'
  let isKeybaseUser = false

  let onCancelInvite = () => {}

  if (user) {
    onCancelInvite = () => _onCancelInvite(ownProps.id)
    label = user.username || user.name || user.email || user.phone
    subLabel = user.name ? user.phone || user.email : undefined
    role = user.role
    isKeybaseUser = !!user.username
    if (!subLabel && labelledInviteRegex.test(label)) {
      const match = labelledInviteRegex.exec(label)!
      label = match[1] ?? ''
      subLabel = match[2]
    }
    try {
      label = label === user.phone ? formatPhoneNumber('+' + label) : label
      subLabel = subLabel === user.phone ? formatPhoneNumber('+' + subLabel) : subLabel
    } catch {}
  }
  const props = {
    firstItem: ownProps.firstItem,
    isKeybaseUser,
    label,
    onCancelInvite,
    role,
    subLabel,
  }
  return <TeamInviteRow {...props} />
}
