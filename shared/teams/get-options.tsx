import * as Kb from '@/common-adapters'
import {HeaderRightActions} from './main/header'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useTeamsState} from '@/stores/teams'
import {useNavigation, useRoute} from '@react-navigation/native'
import type {RootParamList, RootRouteProps} from '@/router-v2/route-params'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'

const useHeaderActions = () => {
  const nav = useSafeNavigation()
  const launchNewTeamWizardOrModal = useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  return {
    onCreateTeam: () => launchNewTeamWizardOrModal(),
    onJoinTeam: () => nav.safeNavigateAppend('teamJoinTeamDialog'),
  }
}

const TeamsFilter = () => {
  const params = useRoute<RootRouteProps<'teamsRoot'>>().params ?? {}
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList, 'teamsRoot'>>()
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
