import * as C from '../constants'
import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {HeaderRightActions} from './main/header'

const Root = React.lazy(async () => import('./container'))

const useHeaderActions = () => {
  const nav = Container.useSafeNavigation()
  const launchNewTeamWizardOrModal = C.useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  return {
    onCreateTeam: () => launchNewTeamWizardOrModal(),
    onJoinTeam: () => nav.safeNavigateAppend({props: {}, selected: 'teamJoinTeamDialog'}),
  }
}

const TeamsFilter = () => {
  const filterValue = C.useTeamsState(s => s.teamListFilter)
  const numTeams = C.useTeamsState(s => s.teamMeta.size)
  const setTeamListFilterSort = C.useTeamsState(s => s.dispatch.setTeamListFilterSort)
  const setFilter = (filter: string) => setTeamListFilterSort(filter)
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
const filterStyles = Styles.styleSheetCreate(() => ({
  filter: {
    alignSelf: 'flex-end',
    marginBottom: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xsmall,
  },
}))

const ConnectedHeaderRightActions = (_: {}) => {
  const actions = useHeaderActions()
  return <HeaderRightActions {...actions} />
}

const getOptions = () => ({
  headerRightActions: !Styles.isMobile ? () => <TeamsFilter /> : () => <ConnectedHeaderRightActions />,
  title: 'Teams',
})

const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
