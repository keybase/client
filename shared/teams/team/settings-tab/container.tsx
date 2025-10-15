import * as React from 'react'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import {Settings} from '.'
import {useSettingsTabState} from './use-settings'

export type OwnProps = {
  teamID: T.Teams.TeamID
}

const Container = (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const teamMeta = C.useTeamsState(s => C.Teams.getTeamMeta(s, teamID))
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID)) ?? C.Teams.emptyTeamDetails
  const publicityAnyMember = teamMeta.allowPromote
  const publicityMember = teamMeta.showcasing
  const publicityTeam = teamDetails.settings.teamShowcased
  const settings = teamDetails.settings
  const welcomeMessage = C.useTeamsState(s => s.teamIDToWelcomeMessage.get(teamID))
  const canShowcase = teamMeta.allowPromote || teamMeta.role === 'admin' || teamMeta.role === 'owner'
  const error = C.useTeamsState(s => s.errorInSettings)
  const ignoreAccessRequests = teamDetails.settings.tarsDisabled
  const isBigTeam = C.useChatState(s => C.Chat.isBigTeam(s, teamID))
  const openTeam = settings.open
  const openTeamRole = teamDetails.settings.openJoinAs
  const teamname = teamMeta.teamname
  const waitingForWelcomeMessage = C.Waiting.useAnyWaiting(C.Teams.loadWelcomeMessageWaitingKey(teamID))
  const yourOperations = C.useTeamsState(s => C.Teams.getCanPerformByID(s, teamID))
  const _loadWelcomeMessage = C.useTeamsState(s => s.dispatch.loadWelcomeMessage)
  const resetErrorInSettings = C.useTeamsState(s => s.dispatch.resetErrorInSettings)
  const setPublicity = C.useTeamsState(s => s.dispatch.setPublicity)
  const clearError = resetErrorInSettings
  const loadWelcomeMessage = React.useCallback(() => {
    _loadWelcomeMessage(teamID)
  }, [_loadWelcomeMessage, teamID])
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _savePublicity = React.useCallback(
    (settings: T.Teams.PublicitySettings) => {
      setPublicity(teamID, settings)
    },
    [setPublicity, teamID]
  )
  const showOpenTeamWarning = React.useCallback(
    (isOpenTeam: boolean, teamname: string) => {
      navigateAppend({props: {isOpenTeam, teamname}, selected: 'openTeamWarning'})
    },
    [navigateAppend]
  )
  const allowOpenTrigger = useSettingsTabState(s => s.allowOpenTrigger)

  const savePublicity = React.useCallback(
    (settings: T.Teams.PublicitySettings) => {
      _savePublicity(settings)
      clearError()
    },
    [_savePublicity, clearError]
  )

  // reset if incoming props change on us
  const [key, setKey] = React.useState(0)
  React.useEffect(() => {
    setKey(k => k + 1)
  }, [ignoreAccessRequests, openTeam, openTeamRole, publicityAnyMember, publicityMember, publicityTeam])

  return (
    <Settings
      key={key}
      allowOpenTrigger={allowOpenTrigger}
      canShowcase={canShowcase}
      error={error}
      ignoreAccessRequests={ignoreAccessRequests}
      isBigTeam={isBigTeam}
      loadWelcomeMessage={loadWelcomeMessage}
      openTeam={openTeam}
      openTeamRole={openTeamRole}
      publicityAnyMember={publicityAnyMember}
      publicityMember={publicityMember}
      publicityTeam={publicityTeam}
      savePublicity={savePublicity}
      showOpenTeamWarning={showOpenTeamWarning}
      teamID={teamID}
      teamname={teamname}
      waitingForWelcomeMessage={waitingForWelcomeMessage}
      welcomeMessage={welcomeMessage}
      yourOperations={yourOperations}
    />
  )
}

export default Container
