import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'
import {makeNewTeamWizard} from './new-team/wizard/state'
import {useTeamsList} from './use-teams-list'
import {useRoute, useNavigation} from '@react-navigation/native'

export const useHeaderActions = () => {
  const nav = useSafeNavigation()
  return {
    onCreateTeam: () =>
      nav.safeNavigateAppend({name: 'teamWizard1TeamPurpose', params: {wizard: makeNewTeamWizard()}}),
    onJoinTeam: () => nav.safeNavigateAppend({name: 'teamJoinTeamDialog', params: {}}),
  }
}

const TeamsFilter = () => {
  const route = useRoute('teamsRoot')
  const params = route.params
  const navigation = useNavigation('teamsRoot')
  const filterValue = params.filter ?? ''
  const {teams} = useTeamsList()
  const numTeams = teams.length
  const setFilter = (filter: string) => navigation.setParams({...params, filter})
  return numTeams >= 20 ? (
    <Kb.SearchFilter
      value={filterValue}
      valueControlled={true}
      onChange={setFilter}
      size="small"
      placeholderText="Filter"
      hotkey="k"
      icon="iconfont-filter"
      style={styles.filter}
    />
  ) : null
}

const HeaderRightActions = () => {
  const {onCreateTeam, onJoinTeam} = useHeaderActions()
  return (
    <Kb.Box2 gap="tiny" direction="horizontal" alignItems="center" style={styles.headerActions}>
      <Kb.Button label="Create a team" onClick={onCreateTeam} small={true} />
      <Kb.Button label="Join a team" onClick={onJoinTeam} small={true} type="Default" mode="Secondary" />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  filter: {
    alignSelf: 'flex-end',
    marginBottom: Kb.Styles.globalMargins.xtiny,
    marginRight: Kb.Styles.globalMargins.xsmall,
  },
  headerActions: Kb.Styles.platformStyles({
    common: {marginBottom: Kb.Styles.globalMargins.xtiny, paddingRight: Kb.Styles.globalMargins.small},
    isElectron: {...Kb.Styles.desktopStyles.windowDraggingClickable},
  }),
}))

export default {
  headerRightActions: !isMobile ? () => <TeamsFilter /> : () => <HeaderRightActions />,
  title: 'Teams',
}
