import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import OpenMeta from './openmeta'
import {default as TeamInfo, type Props as TeamInfoProps} from './teaminfo'
import {useCurrentUserState} from '@/stores/current-user'
import {useTeamsState} from '@/stores/teams'
import {useTrackerState} from '@/stores/tracker'

type OwnProps = {username: string}

const noTeams: Array<T.Tracker.TeamShowcase> = []

const getTeamMembershipByName = ({
  roles,
  teamNameToID,
  teamShowcase,
}: {
  roles: ReadonlyMap<T.Teams.TeamID, T.Teams.TeamRoleAndDetails>
  teamNameToID: ReadonlyMap<string, T.Teams.TeamID>
  teamShowcase: ReadonlyArray<T.Tracker.TeamShowcase>
}) =>
  teamShowcase.reduce<Record<string, boolean>>((membershipByName, team) => {
    const teamID = teamNameToID.get(team.name) || T.Teams.noTeamID
    membershipByName[team.name] = (roles.get(teamID)?.role || 'none') !== 'none'
    return membershipByName
  }, {})

const Container = ({username}: OwnProps) => {
  const {teamShowcase = noTeams} = useTrackerState(s => s.getDetails(username))
  const isYou = useCurrentUserState(s => s.username === username)
  const {joinTeam, roles, showTeamByName, teamNameToID, youAreInTeams} = useTeamsState(
    C.useShallow(s => ({
      joinTeam: s.dispatch.joinTeam,
      roles: s.teamRoleMap.roles,
      showTeamByName: s.dispatch.showTeamByName,
      teamNameToID: s.teamNameToID,
      youAreInTeams: s.teamnames.size > 0,
    }))
  )
  const {clearModals, navigateAppend} = C.useRouterState(
    C.useShallow(s => ({
      clearModals: s.dispatch.clearModals,
      navigateAppend: s.dispatch.navigateAppend,
    }))
  )

  const canEditShowcase = isYou && youAreInTeams
  const membershipByName = getTeamMembershipByName({roles, teamNameToID, teamShowcase})
  const onEdit = canEditShowcase ? () => navigateAppend('profileShowcaseTeamOffer') : undefined
  const onViewTeam = (teamname: string) => {
    clearModals()
    showTeamByName(teamname)
  }

  if (!canEditShowcase && teamShowcase.length === 0) {
    return null
  }

  return (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.showcases}>
      <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
        <Kb.Text type="BodySmallSemibold">Teams</Kb.Text>
        {!!onEdit && <Kb.Icon type="iconfont-edit" onClick={onEdit} />}
      </Kb.Box2>
      {!!onEdit && teamShowcase.length === 0 && <ShowcaseTeamsOffer onEdit={onEdit} />}
      {teamShowcase.map(team => (
        <TeamShowcase
          key={team.name}
          {...team}
          inTeam={membershipByName[team.name] ?? false}
          onJoinTeam={joinTeam}
          onViewTeam={() => onViewTeam(team.name)}
        />
      ))}
    </Kb.Box2>
  )
}

const TeamShowcase = (props: Omit<TeamInfoProps, 'visible' | 'onHidden'>) => {
  const makePopup = ({attachTo, hidePopup}: Kb.Popup2Parms) => (
    <TeamInfo {...props} attachTo={attachTo} onHidden={hidePopup} visible={true} />
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.ClickableBox ref={popupAnchor} onClick={showPopup}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.showcase}>
        {popup}
        <Kb.Avatar size={32} teamname={props.name} isTeam={true} />
        <Kb.Text type="BodySemiboldLink" style={styles.link}>
          {props.name}
        </Kb.Text>
        <OpenMeta isOpen={props.isOpen} />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const ShowcaseTeamsOffer = ({onEdit}: {onEdit: () => void}) => (
  <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
    <Kb.ClickableBox onClick={onEdit}>
      <Kb.Box2 direction="horizontal" gap="tiny">
        <Kb.ImageIcon type="icon-team-placeholder-avatar-32" style={styles.placeholderTeam} />
        <Kb.Text style={styles.youFeatureTeam} type="BodyPrimaryLink">
          {"Feature the teams you're in"}
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      link: {color: Kb.Styles.globalColors.black},
      placeholderTeam: {borderRadius: Kb.Styles.borderRadius},
      showcase: {alignItems: 'center'},
      showcases: {
        alignItems: 'flex-start',
        flexShrink: 0,
        paddingBottom: Kb.Styles.globalMargins.small,
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      youFeatureTeam: {
        alignSelf: 'center',
        color: Kb.Styles.globalColors.black_50,
      },
    }) as const
)

export default Container
