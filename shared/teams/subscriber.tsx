import * as C from '@/constants'
import * as React from 'react'
import {useTeamsState} from '@/stores/teams'
import type * as T from '@/constants/types'

// NOTE: If you are in a floating box or otherwise outside the navigation
// context, you must use `*MountOnly` variants of these helpers

const useTeamsSubscribeMobile = () => {
  const getTeams = useTeamsState(s => s.dispatch.getTeams)
  const unsubscribeTeamList = useTeamsState(s => s.dispatch.unsubscribeTeamList)
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      getTeams(true)
      return () => {
        unsubscribeTeamList()
      }
    }, [getTeams, unsubscribeTeamList])
  )
}
const useTeamsSubscribeDesktop = () => {
  const getTeams = useTeamsState(s => s.dispatch.getTeams)
  const unsubscribeTeamList = useTeamsState(s => s.dispatch.unsubscribeTeamList)
  React.useEffect(() => {
    getTeams(true)
    return () => {
      unsubscribeTeamList()
    }
  }, [getTeams, unsubscribeTeamList])
}
export const useTeamsSubscribe = C.isMobile ? useTeamsSubscribeMobile : useTeamsSubscribeDesktop
const useTeamsSubscribeMountOnly = useTeamsSubscribeDesktop

// Dummy component to add to a view to trigger team meta subscription behavior
export const TeamsSubscriberMountOnly = () => {
  useTeamsSubscribeMountOnly()
  return null
}

const useTeamDetailsSubscribeMobile = (teamID: T.Teams.TeamID) => {
  const loadTeam = useTeamsState(s => s.dispatch.loadTeam)
  const unsubscribeTeamDetails = useTeamsState(s => s.dispatch.unsubscribeTeamDetails)
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      loadTeam(teamID, true)
      return () => unsubscribeTeamDetails(teamID)
    }, [loadTeam, unsubscribeTeamDetails, teamID])
  )
}
const useTeamDetailsSubscribeDesktop = (teamID: T.Teams.TeamID) => {
  const loadTeam = useTeamsState(s => s.dispatch.loadTeam)
  const unsubscribeTeamDetails = useTeamsState(s => s.dispatch.unsubscribeTeamDetails)
  React.useEffect(() => {
    loadTeam(teamID, true)
    return () => unsubscribeTeamDetails(teamID)
  }, [loadTeam, unsubscribeTeamDetails, teamID])
}
export const useTeamDetailsSubscribe = C.isMobile
  ? useTeamDetailsSubscribeMobile
  : useTeamDetailsSubscribeDesktop
export const useTeamDetailsSubscribeMountOnly = useTeamDetailsSubscribeDesktop

// Dummy component to add to a view to trigger team meta subscription behavior
export const TeamDetailsSubscriber = (props: {teamID: T.Teams.TeamID}) => {
  useTeamDetailsSubscribe(props.teamID)
  return null
}
