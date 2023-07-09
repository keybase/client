import * as React from 'react'
import * as TeamsGen from '../actions/teams-gen'
import * as Container from '../util/container'
import * as Constants from '../constants/teams'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {HeaderRightActions} from './main/header'

const Root = React.lazy(async () => import('./container'))

const useHeaderActions = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  return {
    onCreateTeam: () => dispatch(TeamsGen.createLaunchNewTeamWizardOrModal()),
    onJoinTeam: () =>
      dispatch(nav.safeNavigateAppendPayload({path: [{props: {}, selected: 'teamJoinTeamDialog'}]})),
  }
}

const TeamsFilter = () => {
  const dispatch = Container.useDispatch()
  const filterValue = Container.useSelector(s => s.teams.teamListFilter)
  const numTeams = Constants.useState(s => s.teamMeta.size)
  const setFilter = (filter: string) => dispatch(TeamsGen.createSetTeamListFilterSort({filter}))
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
