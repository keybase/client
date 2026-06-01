import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import TeamRow from './teams/team-row'
import TeamSection from './teams/team-section'
import useTeamInfoPopup from './teams/use-team-info-popup'

type ItemProps = {
  team: T.RPCChat.SharedTeam
}

const SharedTeamItem = ({team}: ItemProps) => {
  const {loadingTeam, onClick, pendingOpen, popup, popupAnchor} = useTeamInfoPopup({
    loadOnDemand: true,
    teamID: team.teamID,
    teamname: team.name,
  })

  return (
    <TeamRow
      name={team.name}
      loading={pendingOpen && loadingTeam}
      onClick={onClick}
      popup={popup}
      popupAnchor={popupAnchor}
    />
  )
}

type Props = {
  sharedTeams?: ReadonlyArray<T.RPCChat.SharedTeam>
  username: string
}

const SharedTeams = ({sharedTeams, username}: Props) => {
  const you = useCurrentUserState(s => s.username)
  const loading = C.Waiting.useAnyWaiting(C.waitingKeyTrackerSharedTeams(username))

  if (!you || username === you) return null

  if (sharedTeams === undefined && loading) {
    return (
      <TeamSection title="Teams in common">
        <Kb.Box2 direction="horizontal" style={styles['loadingRow']} gap="tiny">
          <Kb.ProgressIndicator />
        </Kb.Box2>
      </TeamSection>
    )
  }

  if (!sharedTeams?.length) return null

  return (
    <TeamSection title="Teams in common">
      {sharedTeams.map(team => (
        <SharedTeamItem key={team.teamID} team={team} />
      ))}
    </TeamSection>
  )
}

export default SharedTeams

const styles = Kb.Styles.styleSheetCreate(() => ({
  loadingRow: Kb.Styles.paddingV(Kb.Styles.globalMargins.tiny),
}))
