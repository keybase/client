import * as React from 'react'
import * as Styles from '../../../styles'
import * as ChatConstants from '../../../constants/chat2'
import * as TeamsConstants from '../../../constants/teams'
import type * as ChatTypes from '../../../constants/types/chat2'
import type * as TeamTypes from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import shallowEqual from 'shallowequal'

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

const emptyMap = new Map()
const isBot = (type: TeamTypes.TeamRoleType) => type === 'bot' || type === 'restrictedbot'

export const useTeamHumans = (teamID: TeamTypes.TeamID) => {
  const [lastTID, setLastTID] = React.useState('')
  const getMembers = TeamsConstants.useState(s => s.dispatch.getMembers)
  if (lastTID !== teamID) {
    setLastTID(teamID)
    getMembers(teamID)
  }
  const teamMembers = TeamsConstants.useState(s => s.teamIDToMembers.get(teamID)) || emptyMap
  const bots = React.useMemo(() => {
    const ret = new Set<string>()
    teamMembers.forEach(({type}, username) => isBot(type) && ret.add(username))
    return ret
  }, [teamMembers])
  const teamHumanCount = teamMembers.size - bots.size
  return {bots, teamHumanCount}
}

export const useHumans = (conversationIDKey: ChatTypes.ConversationIDKey) => {
  const {participantInfo, teamType, teamID} = Container.useSelector(state => {
    const meta = ChatConstants.getMeta(state, conversationIDKey)
    const {teamType, teamID} = meta
    const participantInfo = ChatConstants.getParticipantInfo(state, conversationIDKey)
    return {participantInfo, teamID, teamType}
  }, shallowEqual)
  const {bots, teamHumanCount} = useTeamHumans(teamID)
  const channelHumans =
    teamType === 'adhoc' ? participantInfo.name : participantInfo.all.filter(username => !bots.has(username))
  return {channelHumans, teamHumanCount}
}
