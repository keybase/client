import * as Kb from '@/common-adapters'
import {HeaderRightActions} from './main/header'
import {useRouteNavigation} from '@/constants/router'
import {useTeamsState} from '@/stores/teams'

const useHeaderActions = () => {
  const nav = useRouteNavigation()
  const launchNewTeamWizardOrModal = useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  return {
    onCreateTeam: () => launchNewTeamWizardOrModal(),
    onJoinTeam: () => nav.navigateAppend('teamJoinTeamDialog'),
  }
}

const TeamsFilter = () => {
  const filterValue = useTeamsState(s => s.teamListFilter)
  const numTeams = useTeamsState(s => s.teamMeta.size)
  const setFilter = useTeamsState(s => s.dispatch.setTeamListFilter)
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
