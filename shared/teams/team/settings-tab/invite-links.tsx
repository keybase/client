import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/teams'
import * as Constants from '../../../constants/teams'
import * as Styles from '../../../styles'
import {formatExpirationTimeForInviteLink} from '../../../util/timestamp'

type Props = {
  teamID: Types.TeamID
}

const InviteLinks = (props: Props) => {
  const {teamID} = props
  const inviteLinksSet = Container.useSelector(state => Constants.getTeamDetails(state, teamID).inviteLinks)
  const inviteLinks = inviteLinksSet ? [...inviteLinksSet] : []
  // TODO: how to get the most recent nonexpired link
  const mostRecentInviteLink = inviteLinks.length ? inviteLinks[0] : undefined

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onGenLink = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props, selected: 'teamInviteLinksModal'}]}))
  const onViewHistory = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props, selected: 'teamInviteHistory'}]}))

  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} alignItems="flex-start">
      <Kb.Text type="BodySmallSemibold">Invite links</Kb.Text>
      <Kb.Text type="BodySmall">
        Invite people to the team by sharing {mostRecentInviteLink ? 'this link:' : 'a link.'}
      </Kb.Text>
      {mostRecentInviteLink && (
        <Kb.Box2 direction="vertical" style={styles.inviteBox} alignSelf="flex-start">
          <Kb.Box2 direction="horizontal">
            <Kb.CopyText text={mostRecentInviteLink.url} />
          </Kb.Box2>
          <Kb.Text type="BodySmall">
            Invites as {mostRecentInviteLink.role} · Expires after{' '}
            {formatExpirationTimeForInviteLink(mostRecentInviteLink.expirationTime)}
          </Kb.Text>
        </Kb.Box2>
      )}
      <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} gap="tiny" alignSelf="flex-start">
        <Kb.Button small={true} mode="Secondary" label="Generate invite link" onClick={onGenLink} />
        <Kb.Button small={true} mode="Secondary" label="View link history" onClick={onViewHistory} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

export default InviteLinks

const styles = Styles.styleSheetCreate(
  () =>
    ({
      inviteBox: {
        borderColor: Styles.globalColors.black_10,
        borderRadius: 4,
        borderStyle: 'solid',
        borderWidth: 1,
        marginBottom: Styles.globalMargins.xtiny,
        padding: Styles.globalMargins.tiny,
      },
    } as const)
)
