import * as React from 'react'
import * as Container from '../util/container'
import type * as Types from '../constants/types/teams'
import * as Constants from '../constants/teams'
import * as TeamsGen from '../actions/teams-gen'
import {useFocusEffect} from '@react-navigation/core'

// NOTE: If you are in a floating box or otherwise outside the navigation
// context, you must use `*MountOnly` variants of these helpers

const useTeamsSubscribeMobile = () => {
  const getTeams = Constants.useState(s => s.dispatch.getTeams)
  const unsubscribeTeamList = Constants.useState(s => s.dispatch.unsubscribeTeamList)
  useFocusEffect(
    React.useCallback(() => {
      getTeams(true)
      return () => {
        unsubscribeTeamList()
      }
    }, [getTeams, unsubscribeTeamList])
  )
}
const useTeamsSubscribeDesktop = () => {
  const getTeams = Constants.useState(s => s.dispatch.getTeams)
  const unsubscribeTeamList = Constants.useState(s => s.dispatch.unsubscribeTeamList)
  React.useEffect(() => {
    getTeams(true)
    return () => {
      unsubscribeTeamList()
    }
  }, [getTeams, unsubscribeTeamList])
}
export const useTeamsSubscribe = Container.isMobile ? useTeamsSubscribeMobile : useTeamsSubscribeDesktop
export const useTeamsSubscribeMountOnly = useTeamsSubscribeDesktop

// Dummy component to add to a view to trigger team meta subscription behavior
export const TeamsSubscriber = () => {
  useTeamsSubscribe()
  return null
}

export const TeamsSubscriberMountOnly = () => {
  useTeamsSubscribeMountOnly()
  return null
}

const useTeamDetailsSubscribeMobile = (teamID: Types.TeamID) => {
  const dispatch = Container.useDispatch()
  useFocusEffect(
    React.useCallback(() => {
      dispatch(TeamsGen.createLoadTeam({_subscribe: true, teamID}))
      return () => dispatch(TeamsGen.createUnsubscribeTeamDetails({teamID}))
    }, [dispatch, teamID])
  )
}
const useTeamDetailsSubscribeDesktop = (teamID: Types.TeamID) => {
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(TeamsGen.createLoadTeam({_subscribe: true, teamID}))
    return () => {
      dispatch(TeamsGen.createUnsubscribeTeamDetails({teamID}))
    }
  }, [dispatch, teamID])
}
export const useTeamDetailsSubscribe = Container.isMobile
  ? useTeamDetailsSubscribeMobile
  : useTeamDetailsSubscribeDesktop
export const useTeamDetailsSubscribeMountOnly = useTeamDetailsSubscribeDesktop

// Dummy component to add to a view to trigger team meta subscription behavior
export const TeamDetailsSubscriber = (props: {teamID: Types.TeamID}) => {
  useTeamDetailsSubscribe(props.teamID)
  return null
}

export const TeamDetailsSubscriberMountOnly = (props: {teamID: Types.TeamID}) => {
  useTeamDetailsSubscribeMountOnly(props.teamID)
  return null
}
