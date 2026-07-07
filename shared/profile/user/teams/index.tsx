import * as C from '@/constants'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useCurrentUserState} from '@/stores/current-user'
import {useTeamsList, useTeamsListNameToIDMap} from '@/teams/use-teams-list'
import {showTeamByName} from '@/teams/team-page-actions'
import TeamRow from './team-row'
import TeamSection from './team-section'
import useTeamInfoPopup from './use-team-info-popup'

type OwnProps = {
  teamShowcase?: ReadonlyArray<T.Tracker.TeamShowcase>
  username: string
}

const noTeams = new Array<T.Tracker.TeamShowcase>()

const Teams = (ownProps: OwnProps) => {
  const isYou = useCurrentUserState(s => s.username === ownProps.username)
  const {teams} = useTeamsList()
  const teamNameToID = useTeamsListNameToIDMap()
  const youAreInTeams = teams.length > 0
  const teamShowcase = ownProps.teamShowcase || noTeams
  const {clearModals, navigateAppend} = C.Router2
  const onEditTeams = () => {
    navigateAppend({name: 'profileShowcaseTeamOffer', params: {}})
  }
  const onJoinTeam = (teamname: string) =>
    navigateAppend({name: 'teamJoinTeamDialog', params: {initialTeamname: teamname}})
  const onViewTeam = (teamname: string) => {
    clearModals()
    const teamID = teamNameToID.get(teamname)
    if (teamID) {
      navigateAppend({name: 'team', params: {teamID}})
      return
    }
    void showTeamByName(teamname)
  }
  const onEdit = isYou && youAreInTeams ? onEditTeams : undefined

  return onEdit || teamShowcase.length > 0 ? (
    <TeamSection title="Featured teams" right={!!onEdit && <Kb.Icon type="iconfont-edit" onClick={onEdit} />}>
      {!!onEdit && !teamShowcase.length && <ShowcaseTeamsOffer onEdit={onEdit} />}
      {teamShowcase.map(t => (
        <TeamShowcase
          key={t.name}
          {...t}
          onJoinTeam={onJoinTeam}
          onViewTeam={() => onViewTeam(t.name)}
          inTeam={teamNameToID.has(t.name)}
        />
      ))}
    </TeamSection>
  ) : null
}

type TeamShowcaseProps = T.Tracker.TeamShowcase & {
  inTeam: boolean
  onJoinTeam: (teamname: string) => void
  onViewTeam: () => void
}

const TeamShowcase = (props: TeamShowcaseProps) => {
  const {name, isOpen} = props
  const {onClick, popup, popupAnchor} = useTeamInfoPopup({
    popupInfo: props,
    teamname: name,
  })
  return <TeamRow name={name} isOpen={isOpen} onClick={onClick} popup={popup} popupAnchor={popupAnchor} />
}

const ShowcaseTeamsOffer = (p: {onEdit: () => void}) => (
  <Kb.ClickableBox direction="horizontal" gap="tiny" fullWidth={true} onClick={p.onEdit}>
    <Kb.ImageIcon type="icon-team-placeholder-avatar-32" style={styles.placeholderTeam} />
    <Kb.Text style={styles.youFeatureTeam} type="BodyPrimaryLink">
      {"Feature the teams you're in"}
    </Kb.Text>
  </Kb.ClickableBox>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      placeholderTeam: {borderRadius: Kb.Styles.borderRadius},
      youFeatureTeam: {
        alignSelf: 'center',
        color: Kb.Styles.globalColors.black_50,
      },
    }) as const
)

export default Teams
