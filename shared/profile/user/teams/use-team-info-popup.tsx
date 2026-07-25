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
  // `loaded`, not a non-empty teamname: useLoadedTeam seeds teamMeta from the cheap
  // teams-list, so a team you're in looks named long before its details exist.
  const inTeam = teamMeta.role !== 'none'
  const description = loaded ? teamDetails.description : (popupInfo?.description ?? '')
  const isOpen = loaded ? teamDetails.settings.open : (popupInfo?.isOpen ?? false)
  const membersCount = loaded ? teamDetails.members.size : (popupInfo?.membersCount ?? 0)

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
    if (!loadOnDemand || teamID === T.Teams.noTeamID || loaded) {
      showPopup()
      return
    }
    setHasRequestedLoad(true)
    // popupInfo already carries everything the popup shows (it comes from the
    // profile's showcase payload), so open now and let the load refine it
    if (popupInfo) {
      showPopup()
      return
    }
    if (loadingTeam || pendingOpen) {
      return
    }
    hasSeenPendingLoadRef.current = false
    setPendingOpen(true)
  }, [loaded, loadOnDemand, loadingTeam, pendingOpen, popupInfo, showPopup, teamID])

  return {loadingTeam, onClick, pendingOpen, popup, popupAnchor}
}

export default useTeamInfoPopup
