import * as Kb from '@/common-adapters'
import {HeaderRightActions} from './main/header'
import {useSafeNavigation} from '@/util/safe-navigation'
import {makeNewTeamWizard} from './new-team/wizard/state'
import {useTeamsList} from './use-teams-list'
import {useRoute} from '@react-navigation/native'
import type {RootRouteProps} from '@/router-v2/route-params'
import {useTypedNavigation} from '@/util/typed-navigation'

const useHeaderActions = () => {
  const nav = useSafeNavigation()
  return {
    onCreateTeam: () =>
      nav.safeNavigateAppend({name: 'teamWizard1TeamPurpose', params: {wizard: makeNewTeamWizard()}}),
    onJoinTeam: () => nav.safeNavigateAppend({name: 'teamJoinTeamDialog', params: {}}),
  }
}

const TeamsFilter = () => {
  const route = useRoute() as RootRouteProps<'teamsRoot'>
  const params = route.params
  const navigation = useTypedNavigation('teamsRoot')
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
      style={filterStyles.filter}
    />
  ) : null
}

const filterStyles = Kb.Styles.styleSheetCreate(() => ({
  filter: {
    alignSelf: 'flex-end',
    marginBottom: Kb.Styles.globalMargins.xtiny,
    marginRight: Kb.Styles.globalMargins.xsmall,
  },
}))

const ConnectedHeaderRightActions = () => {
  const actions = useHeaderActions()
  return <HeaderRightActions {...actions} />
}

export default {
  headerRightActions: !isMobile ? () => <TeamsFilter /> : () => <ConnectedHeaderRightActions />,
  title: 'Teams',
}
