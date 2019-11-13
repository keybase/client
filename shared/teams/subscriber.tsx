import * as React from 'react'
import * as Container from '../util/container'
import * as TeamsGen from '../actions/teams-gen'
import {NavigationEventCallback} from '@react-navigation/core'
import {useNavigationEvents} from '../util/navigation-hooks'

const useTeamsSubscribeMobile = () => {
  const dispatch = Container.useDispatch()
  const callback: NavigationEventCallback = e => {
    if (e.type === 'didFocus') {
      dispatch(TeamsGen.createGetTeams({_subscribe: true}))
    } else if (e.type === 'willBlur') {
      dispatch(TeamsGen.createUnsubscribeTeamList())
    }
  }
  useNavigationEvents(callback)

  // Workaround navigation blur events flakiness, make sure we unsubscribe on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => () => dispatch(TeamsGen.createUnsubscribeTeamList()), [])
}
const useTeamsSubscribeDesktop = () => {
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(TeamsGen.createGetTeams({_subscribe: true}))
    return () => dispatch(TeamsGen.createUnsubscribeTeamList())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
export const useTeamsSubscribe = Container.isMobile ? useTeamsSubscribeMobile : useTeamsSubscribeDesktop

// Dummy component to add to a view to trigger team meta subscription behavior
export const TeamSubscriber = () => {
  useTeamsSubscribe()
  return null
}
