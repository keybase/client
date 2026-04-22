import type {ConvoState} from '@/stores/convostate'
import * as Styles from '@/styles'
import type * as T from '@/constants/types'
import {useChatTeamMembers} from '../team-hooks'

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
  const {members: teamMembers} = useChatTeamMembers(teamID)
  const bots = (() => {
    const ret = new Set<string>()
    teamMembers.forEach(({type}, username) => isBot(type) && ret.add(username))
    return ret
  })()
  const teamHumanCount = teamMembers.size - bots.size
  return {bots, teamHumanCount}
}

export const useHumans = (
  participantInfo: ConvoState['participants'],
  meta: ConvoState['meta']
) => {
  const {teamType, teamID} = meta
  const {bots, teamHumanCount} = useTeamHumans(teamID)
  const channelHumans =
    teamType === 'adhoc' ? participantInfo.name : participantInfo.all.filter(username => !bots.has(username))
  return {channelHumans, teamHumanCount}
}
