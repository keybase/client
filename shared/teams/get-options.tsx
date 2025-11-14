import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {HeaderRightActions} from './main/header'
import {useSafeNavigation} from '@/util/safe-navigation'

const useHeaderActions = () => {
  const nav = useSafeNavigation()
  const launchNewTeamWizardOrModal = C.useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  return {
    onCreateTeam: () => launchNewTeamWizardOrModal(),
    onJoinTeam: () => nav.safeNavigateAppend('teamJoinTeamDialog'),
  }
}

const TeamsFilter = () => {
  const filterValue = C.useTeamsState(s => s.teamListFilter)
  const numTeams = C.useTeamsState(s => s.teamMeta.size)
  const setFilter = C.useTeamsState(s => s.dispatch.setTeamListFilter)
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
