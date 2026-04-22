import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {HeaderRightActions} from './main/header'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useTeamsState} from '@/stores/teams'
import {makeNewTeamWizard} from './new-team/wizard/state'
import {useNavigation, useRoute} from '@react-navigation/native'
import type {RouteProp} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'

type TeamsRootParams = {
  filter?: string
  sort?: T.Teams.TeamListSort
}
type TeamsRootParamList = {teamsRoot: TeamsRootParams}

const useHeaderActions = () => {
  const nav = useSafeNavigation()
  return {
    onCreateTeam: () =>
      nav.safeNavigateAppend({name: 'teamWizard1TeamPurpose', params: {wizard: makeNewTeamWizard()}}),
    onJoinTeam: () => nav.safeNavigateAppend({name: 'teamJoinTeamDialog', params: {}}),
  }
}

const TeamsFilter = () => {
  const route = useRoute<RouteProp<TeamsRootParamList, 'teamsRoot'>>()
  const params = route.params
  const navigation = useNavigation<NativeStackNavigationProp<TeamsRootParamList, 'teamsRoot'>>()
  const filterValue = params.filter ?? ''
  const numTeams = useTeamsState(s => s.teamMeta.size)
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
  headerRightActions: !Kb.Styles.isMobile ? () => <TeamsFilter /> : () => <ConnectedHeaderRightActions />,
  title: 'Teams',
}
