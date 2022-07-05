import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/teams'
import * as Constants from '../../../constants/teams'
import * as Styles from '../../../styles'
import {InviteItem} from './../invites/invite-item'

type Props = {
  teamID: Types.TeamID
}

const InviteLinks = (props: Props) => {
  const {teamID} = props
  const inviteLinks = Container.useSelector(state => Constants.getTeamDetails(state, teamID).inviteLinks)
  const mostRecentInviteLink = Constants.maybeGetMostRecentValidInviteLink(inviteLinks)
  const validInviteLinkCount = Constants.countValidInviteLinks(inviteLinks)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onGenLink = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props, selected: 'teamInviteLinksGenerate'}]}))
  const onViewHistory = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props, selected: 'teamInviteHistory'}]}))

  const additionalValidIndicator = validInviteLinkCount > 1 ? `(${validInviteLinkCount} active)` : ''
  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} alignItems="flex-start">
      <Kb.Text type="BodySmallSemibold">Invite links {additionalValidIndicator}</Kb.Text>
      <Kb.Text type="BodySmall">
        Invite people to the team by sharing {mostRecentInviteLink ? 'this link:' : 'a link.'}
      </Kb.Text>
      {mostRecentInviteLink && (
        <InviteItem
          inviteLink={mostRecentInviteLink}
          teamID={teamID}
          alignSelf="flex-start"
          showDetails={false}
          showExpireAction={false}
        />
      )}
      <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} gap="tiny" alignSelf="flex-start">
        <Kb.Button small={true} mode="Secondary" label="Generate invite link" onClick={onGenLink} />
        <Kb.Button small={true} mode="Secondary" label="Manage invite links" onClick={onViewHistory} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

export default InviteLinks
