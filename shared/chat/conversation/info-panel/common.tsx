import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import type * as T from '@/constants/types'

export const infoPanelWidthElectron = 320
const infoPanelWidthPhone = Styles.dimensionWidth
export const infoPanelWidthTablet = 350

export function infoPanelWidth() {
  if (Styles.isTablet) {
    return infoPanelWidthTablet
  } else if (Styles.isMobile) {
    return infoPanelWidthPhone
  } else {
    return infoPanelWidthElectron
  }
}

const isBot = (type: T.Teams.TeamRoleType) => type === 'bot' || type === 'restrictedbot'

export const useTeamHumans = (teamID: T.Teams.TeamID) => {
  const [lastTID, setLastTID] = React.useState('')
  const getMembers = C.useTeamsState(s => s.dispatch.getMembers)
  if (lastTID !== teamID) {
    setLastTID(teamID)
    getMembers(teamID)
  }
  const teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(teamID))
  const bots = React.useMemo(() => {
    const ret = new Set<string>()
    teamMembers?.forEach(({type}, username) => isBot(type) && ret.add(username))
    return ret
  }, [teamMembers])
  const teamHumanCount = (teamMembers?.size ?? 0) - bots.size
  return {bots, teamHumanCount}
}

export const useHumans = (
  participantInfo: C.Chat.ConvoState['participants'],
  meta: C.Chat.ConvoState['meta']
) => {
  const {teamType, teamID} = meta
  const {bots, teamHumanCount} = useTeamHumans(teamID)
  const channelHumans =
    teamType === 'adhoc' ? participantInfo.name : participantInfo.all.filter(username => !bots.has(username))
  return {channelHumans, teamHumanCount}
}
