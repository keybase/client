import * as C from '../constants'
import * as React from 'react'
import * as Container from '../util/container'
import type * as Types from '../constants/types/teams'
import {useFocusEffect} from '@react-navigation/core'

// NOTE: If you are in a floating box or otherwise outside the navigation
// context, you must use `*MountOnly` variants of these helpers

const useTeamsSubscribeMobile = () => {
  const getTeams = C.useTeamsState(s => s.dispatch.getTeams)
  const unsubscribeTeamList = C.useTeamsState(s => s.dispatch.unsubscribeTeamList)
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
  const getTeams = C.useTeamsState(s => s.dispatch.getTeams)
  const unsubscribeTeamList = C.useTeamsState(s => s.dispatch.unsubscribeTeamList)
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
  const loadTeam = C.useTeamsState(s => s.dispatch.loadTeam)
  const unsubscribeTeamDetails = C.useTeamsState(s => s.dispatch.unsubscribeTeamDetails)
  useFocusEffect(
    React.useCallback(() => {
      loadTeam(teamID, true)
      return () => unsubscribeTeamDetails(teamID)
    }, [loadTeam, unsubscribeTeamDetails, teamID])
  )
}
const useTeamDetailsSubscribeDesktop = (teamID: Types.TeamID) => {
  const loadTeam = C.useTeamsState(s => s.dispatch.loadTeam)
  const unsubscribeTeamDetails = C.useTeamsState(s => s.dispatch.unsubscribeTeamDetails)
  React.useEffect(() => {
    loadTeam(teamID, true)
    return () => unsubscribeTeamDetails(teamID)
  }, [loadTeam, unsubscribeTeamDetails, teamID])
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
