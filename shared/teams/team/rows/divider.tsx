import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import * as TeamsGen from '../../../actions/teams-gen'

// Based on type, render a plain label with (count)
// or a collapsible one that persists in the store.

type Props = {
  count: number
  teamID: Types.TeamID
  type: 'requests' | 'invites' | 'members'
}

const typeToLabel = {members: 'Already in team', requests: 'Requests'}

const TeamPageDivider = (props: Props) => {
  if (props.type === 'invites') {
    return <InvitesDivider {...props} />
  }
  return <Kb.SectionDivider label={typeToLabel[props.type] + ` (${props.count})`} />
}

const InvitesDivider = (props: Props) => {
  const {count, teamID} = props
  const dispatch = Container.useDispatch()
  const invitesCollapsed = Container.useSelector(state => state.teams.invitesCollapsed)
  const collapsed = invitesCollapsed.has(teamID)

  const onToggleCollapsed = () => dispatch(TeamsGen.createToggleInvitesCollapsed({teamID}))
  const collapseProps = Container.isMobile ? {} : {collapsed, onToggleCollapsed}
  return <Kb.SectionDivider {...collapseProps} label={`Invitations (${count})`} />
}

export default TeamPageDivider
