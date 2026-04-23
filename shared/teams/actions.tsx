import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {
  clearModals,
  navigateAppend,
  navigateUp,
  navToProfile,
  navUpToScreen,
} from '@/constants/router'
import logger from '@/logger'
import {RPCError, logError} from '@/util/errors'
import {fixCrop} from '@/util/crop'
import {getTBStore} from '@/stores/team-building'
import {useConfigState} from '@/stores/config'

const newRequestsGregorPrefix = 'team.request_access:'
const newRequestsGregorKey = (teamID: T.Teams.TeamID) => `${newRequestsGregorPrefix}${teamID}`

export const addToTeam = (
  teamID: T.Teams.TeamID,
  users: Array<{assertion: string; role: T.Teams.TeamRoleType}>,
  sendChatNotification: boolean,
  fromTeamBuilder?: boolean
) => {
  const f = async () => {
    try {
      const res = await T.RPCGen.teamsTeamAddMembersMultiRoleRpcPromise(
        {
          sendChatNotification,
          teamID,
          users: users.map(({assertion, role}) => ({
            assertion,
            role: T.RPCGen.TeamRole[role],
          })),
        },
        [
          S.waitingKeyTeamsTeam(teamID),
          S.waitingKeyTeamsAddMember(teamID, ...users.map(({assertion}) => assertion)),
        ]
      )
      if (res.notAdded && res.notAdded.length > 0) {
        const usernames = res.notAdded.map(elem => elem.username)
        getTBStore('teams').dispatch.finishedTeamBuilding()
        navigateAppend({
          name: 'contactRestricted',
          params: {source: 'teamAddSomeFailed', usernames},
        })
        return
      }

      if (fromTeamBuilder) {
        getTBStore('teams').dispatch.finishedTeamBuilding()
      }
    } catch (error) {
      if (!(error instanceof RPCError)) {
        return
      }
      if (error.code === T.RPCGen.StatusCode.scteamcontactsettingsblock) {
        const users = (error.fields as Array<{key?: string; value?: string} | undefined> | undefined)
          ?.filter(elem => elem?.key === 'usernames')
          .map(elem => elem?.value)
        const usernames = users?.[0]?.split(',') ?? []
        getTBStore('teams').dispatch.finishedTeamBuilding()
        navigateAppend({
          name: 'contactRestricted',
          params: {source: 'teamAddAllFailed', usernames},
        })
        return
      }

      const msg = error.desc
      if (fromTeamBuilder) {
        getTBStore('teams').dispatch.setError(msg)
      } else {
        logger.error(`addToTeam failed for ${teamID}: ${msg}`)
      }
    }
  }
  ignorePromise(f())
}

export const clearNavBadges = () => {
  const f = async () => {
    try {
      await T.RPCGen.gregorDismissCategoryRpcPromise({category: 'team.newly_added_to_team'})
      await T.RPCGen.gregorDismissCategoryRpcPromise({category: 'team.delete'})
    } catch (err) {
      logError(err)
    }
  }
  ignorePromise(f())
}

export const deleteTeam = (teamID: T.Teams.TeamID) => {
  const f = async () => {
    try {
      await T.RPCGen.teamsTeamDeleteRpcListener({
        customResponseIncomingCallMap: {
          'keybase.1.teamsUi.confirmRootTeamDelete': (_, response) => response.result(true),
          'keybase.1.teamsUi.confirmSubteamDelete': (_, response) => response.result(true),
        },
        incomingCallMap: {},
        params: {teamID},
        waitingKey: S.waitingKeyTeamsDeleteTeam(teamID),
      })
    } catch (error) {
      if (error instanceof RPCError) {
        logger.warn('error:', error.message)
      }
    }
  }
  ignorePromise(f())
}

export const ignoreRequest = (teamID: T.Teams.TeamID, teamname: string, username: string) => {
  const f = async () => {
    try {
      await T.RPCGen.teamsTeamIgnoreRequestRpcPromise({name: teamname, username}, S.waitingKeyTeamsTeam(teamID))
    } catch {}
  }
  ignorePromise(f())
}

export const leaveTeam = (teamname: string, permanent: boolean, context: 'teams' | 'chat') => {
  const f = async () => {
    logger.info(`leaveTeam: Leaving ${teamname} from context ${context}`)
    try {
      await T.RPCGen.teamsTeamLeaveRpcPromise(
        {name: teamname, permanent},
        S.waitingKeyTeamsLeaveTeam(teamname)
      )
      logger.info(`leaveTeam: left ${teamname} successfully`)
      clearModals()
      navUpToScreen(context === 'chat' ? 'chatRoot' : 'teamsRoot')
    } catch (error) {
      if (error instanceof RPCError) {
        logger.warn('error:', error.message)
      }
    }
  }
  ignorePromise(f())
}

export const reAddToTeam = (teamID: T.Teams.TeamID, username: string) => {
  const f = async () => {
    try {
      await T.RPCGen.teamsTeamReAddMemberAfterResetRpcPromise(
        {id: teamID, username},
        S.waitingKeyTeamsAddMember(teamID, username)
      )
    } catch (error) {
      if (error instanceof RPCError && error.code === T.RPCGen.StatusCode.scidentifysummaryerror) {
        navToProfile(username)
      }
    }
  }
  ignorePromise(f())
}

export const removeMember = (teamID: T.Teams.TeamID, username: string) => {
  const f = async () => {
    try {
      await T.RPCGen.teamsTeamRemoveMemberRpcPromise(
        {
          member: {
            assertion: {assertion: username, removeFromSubtree: false},
            type: T.RPCGen.TeamMemberToRemoveType.assertion,
          },
          teamID,
        },
        [S.waitingKeyTeamsTeam(teamID), S.waitingKeyTeamsRemoveMember(teamID, username)]
      )
    } catch (err) {
      logger.error('Failed to remove member', err)
    }
  }
  ignorePromise(f())
}

export const removePendingInvite = (teamID: T.Teams.TeamID, inviteID: string) => {
  const f = async () => {
    try {
      await T.RPCGen.teamsTeamRemoveMemberRpcPromise(
        {
          member: {inviteid: {inviteID}, type: T.RPCGen.TeamMemberToRemoveType.inviteid},
          teamID,
        },
        [S.waitingKeyTeamsTeam(teamID), S.waitingKeyTeamsRemoveMember(teamID, inviteID)]
      )
    } catch (err) {
      logger.error('Failed to remove pending invite', err)
    }
  }
  ignorePromise(f())
}

export const renameTeam = (oldName: string, newNameString: string) => {
  const f = async () => {
    const prevName = {parts: oldName.split('.')}
    const newName = {parts: newNameString.split('.')}
    try {
      await T.RPCGen.teamsTeamRenameRpcPromise({newName, prevName}, S.waitingKeyTeamsRename)
    } catch {}
  }
  ignorePromise(f())
}

export const saveChannelMembership = (
  teamID: T.Teams.TeamID,
  oldChannelState: T.Teams.ChannelMembershipState,
  newChannelState: T.Teams.ChannelMembershipState
) => {
  const f = async () => {
    const waitingKey = S.waitingKeyTeamsTeam(teamID)
    for (const convIDKeyStr in newChannelState) {
      const conversationIDKey = T.Chat.stringToConversationIDKey(convIDKeyStr)
      if (oldChannelState[conversationIDKey] === newChannelState[conversationIDKey]) {
        continue
      }
      if (newChannelState[conversationIDKey]) {
        try {
          const convID = T.Chat.keyToConversationID(conversationIDKey)
          await T.RPCChat.localJoinConversationByIDLocalRpcPromise({convID}, waitingKey)
        } catch (error) {
          useConfigState.getState().dispatch.setGlobalError(error)
        }
      } else {
        try {
          const convID = T.Chat.keyToConversationID(conversationIDKey)
          await T.RPCChat.localLeaveConversationLocalRpcPromise({convID}, waitingKey)
        } catch (error) {
          useConfigState.getState().dispatch.setGlobalError(error)
        }
      }
    }
  }
  ignorePromise(f())
}

export const setMemberPublicity = (teamID: T.Teams.TeamID, showcase: boolean) => {
  const f = async () => {
    try {
      await T.RPCGen.teamsSetTeamMemberShowcaseRpcPromise({isShowcased: showcase, teamID}, [
        S.waitingKeyTeamsTeam(teamID),
        S.waitingKeyTeamsSetMemberPublicity(teamID),
      ])
    } catch (error) {
      if (error instanceof RPCError) {
        logger.info(error.message)
      }
    }
  }
  ignorePromise(f())
}

export const teamSeen = (teamID: T.Teams.TeamID) => {
  const f = async () => {
    try {
      await T.RPCGen.gregorDismissCategoryRpcPromise({category: newRequestsGregorKey(teamID)})
    } catch (error) {
      if (error instanceof RPCError) {
        logger.error(error.message)
      }
    }
  }
  ignorePromise(f())
}

export const uploadTeamAvatar = (
  teamname: string,
  filename: string,
  sendChatNotification: boolean,
  crop?: T.RPCGen.ImageCropRect
) => {
  const f = async () => {
    try {
      await T.RPCGen.teamsUploadTeamAvatarRpcPromise(
        {crop: fixCrop(crop), filename, sendChatNotification, teamname},
        S.waitingKeyProfileUploadAvatar
      )
      navigateUp()
    } catch (error) {
      if (error instanceof RPCError) {
        logger.warn(`Error uploading team avatar: ${error.message}`)
      }
    }
  }
  ignorePromise(f())
}
