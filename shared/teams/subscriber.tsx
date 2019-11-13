import * as React from 'react'
import * as Container from '../util/container'
import * as TeamsGen from '../actions/teams-gen'

export const useTeamsMeta = (): {loading: boolean} => {
  const dispatch = Container.useDispatch()

  // Subscribe to load teams on mount, unsubscribe on unmount
  React.useEffect(() => {
    dispatch(TeamsGen.createGetTeams({_subscribe: true}))
    return () => dispatch(TeamsGen.createUnsubscribeTeamList())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loading = Container.useSelector(state => state.teams.teamDetailsMetaStale)
  return {loading}
}

export const withTeamSubscription = <P extends object>(Component: React.ComponentType<P>) => {
  const WithTeamSubscription = (props: P) => {
    useTeamsMeta()
    return <Component {...props} />
  }
  return WithTeamSubscription
}
