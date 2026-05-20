import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import {showTeamByName} from '@/teams/team-page-actions'
import {useLoadedTeam} from '@/teams/team/use-loaded-team'
import {useTeamsListNameToIDMap} from '@/teams/use-teams-list'
import TeamInfo, {type Props as TeamInfoProps} from './teaminfo'

type PopupInfo = Pick<TeamInfoProps, 'description' | 'isOpen' | 'membersCount' | 'publicAdmins'>

type Props = {
  loadOnDemand?: boolean
  popupInfo?: Partial<PopupInfo>
  teamID?: T.Teams.TeamID
  teamname: string
}

const emptyPublicAdmins: ReadonlyArray<string> = []

const useTeamInfoPopup = ({loadOnDemand = false, popupInfo, teamID: initialTeamID, teamname}: Props) => {
  const {clearModals, navigateAppend} = C.Router2
  const [hasRequestedLoad, setHasRequestedLoad] = React.useState(false)
  const [pendingOpen, setPendingOpen] = React.useState(false)
  const hasSeenPendingLoadRef = React.useRef(false)
  const teamNameToID = useTeamsListNameToIDMap()
  const teamID = initialTeamID ?? teamNameToID.get(teamname) ?? T.Teams.noTeamID
  const teamLoadEnabled = !loadOnDemand || hasRequestedLoad
  const {loaded, loading: loadingTeam, teamDetails, teamMeta} = useLoadedTeam(teamID, teamLoadEnabled)
  const hasLoadedTeam = teamMeta.teamname.length > 0
  const inTeam = teamMeta.role !== 'none'
  const description = hasLoadedTeam ? teamDetails.description : (popupInfo?.description ?? '')
  const isOpen = hasLoadedTeam ? teamDetails.settings.open : (popupInfo?.isOpen ?? false)
  const membersCount = hasLoadedTeam ? teamDetails.members.size : (popupInfo?.membersCount ?? 0)

  const onJoinTeam = React.useCallback(
    (teamname: string) => {
      navigateAppend({name: 'teamJoinTeamDialog', params: {initialTeamname: teamname}})
    },
    [navigateAppend]
  )
  const onViewTeam = React.useCallback(() => {
    clearModals()
    if (teamID !== T.Teams.noTeamID) {
      navigateAppend({name: 'team', params: {teamID}})
      return
    }
    void showTeamByName(teamname)
  }, [clearModals, navigateAppend, teamID, teamname])
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <TeamInfo
          attachTo={attachTo}
          description={description}
          inTeam={inTeam}
          isOpen={isOpen}
          membersCount={membersCount}
          name={teamname}
          onHidden={hidePopup}
          onJoinTeam={onJoinTeam}
          onViewTeam={onViewTeam}
          publicAdmins={popupInfo?.publicAdmins ?? emptyPublicAdmins}
          visible={true}
        />
      )
    },
    [description, inTeam, isOpen, membersCount, onJoinTeam, onViewTeam, popupInfo, teamname]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  React.useEffect(() => {
    if (!pendingOpen) {
      return
    }
    if (loadingTeam) {
      hasSeenPendingLoadRef.current = true
      return
    }
    if (!hasSeenPendingLoadRef.current) {
      return
    }
    if (loaded) {
      showPopup()
    }
    hasSeenPendingLoadRef.current = false
    setPendingOpen(false)
  }, [loaded, loadingTeam, pendingOpen, showPopup])

  const onClick = React.useCallback(() => {
    if (!loadOnDemand || teamID === T.Teams.noTeamID || hasLoadedTeam) {
      showPopup()
      return
    }
    if (loadingTeam || pendingOpen) {
      return
    }
    setHasRequestedLoad(true)
    hasSeenPendingLoadRef.current = false
    setPendingOpen(true)
  }, [hasLoadedTeam, loadOnDemand, loadingTeam, pendingOpen, showPopup, teamID])

  return {loadingTeam, onClick, pendingOpen, popup, popupAnchor}
}

export default useTeamInfoPopup
