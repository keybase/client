import * as C from '@/constants'
import * as Constants from '@/constants/users'
import * as React from 'react'
import BlockModal, { type BlockModalContext, type BlockType, type NewBlocksMap, type ReportSettings } from '.'

type OwnProps = {
  blockUserByDefault?: boolean
  filterUserByDefault?: boolean
  flagUserByDefault?: boolean
  reportsUserByDefault?: boolean
  context?: BlockModalContext
  conversationIDKey?: string
  others?: Array<string>
  team?: string
  username?: string
}

const Container = (ownProps: OwnProps) => {
  const { context, conversationIDKey } = ownProps
  const teamname = ownProps.team
  const blockUserByDefault = ownProps.blockUserByDefault ?? false
  const filterUserByDefault = ownProps.filterUserByDefault ?? false
  const flagUserByDefault = ownProps.flagUserByDefault ?? false
  const reportsUserByDefault = ownProps.reportsUserByDefault ?? false
  let others = ownProps.others
  let adderUsername = ownProps.username
  const waitingForLeave = C.Waiting.useAnyWaiting(teamname ? C.Teams.leaveTeamWaitingKey(teamname) : undefined)
  const waitingForBlocking = C.Waiting.useAnyWaiting(Constants.setUserBlocksWaitingKey)
  const waitingForReport = C.Waiting.useAnyWaiting(Constants.reportUserWaitingKey)
  if (others?.length === 1 && !adderUsername) {
    adderUsername = others[0]
    others = undefined
  }

  const _allKnownBlocks = C.useUsersState(s => s.blockMap)
  const loadingWaiting = C.Waiting.useAnyWaiting(Constants.getUserBlocksWaitingKey)
  const stateProps = {
    _allKnownBlocks,
    adderUsername,
    blockUserByDefault,
    context,
    convID: conversationIDKey,
    filterUserByDefault,
    finishWaiting: waitingForLeave || waitingForBlocking || waitingForReport,
    flagUserByDefault,
    loadingWaiting,
    otherUsernames: others && others.length > 0 ? others : undefined,
    reportsUserByDefault,
    teamname,
  }

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onClose = navigateUp
  const leaveTeam = C.useTeamsState(s => s.dispatch.leaveTeam)
  const leaveTeamAndBlock = React.useCallback(
    (teamname: string) => {
      leaveTeam(teamname, true, 'chat')
    },
    [leaveTeam]
  )
  const getBlockState = C.useUsersState(s => s.dispatch.getBlockState)
  const _reportUser = C.useUsersState(s => s.dispatch.reportUser)
  const refreshBlocksFor = getBlockState
  const reportUser = React.useCallback(
    (username: string, conversationIDKey: string | undefined, report: ReportSettings) => {
      _reportUser({
        comment: report.extraNotes,
        conversationIDKey,
        includeTranscript: report.includeTranscript && !!conversationIDKey,
        reason: report.reason,
        username,
      })
    },
    [_reportUser]
  )
  const setConversationStatus = C.useChatContext(s => s.dispatch.blockConversation)
  const _setUserBlocks = C.useUsersState(s => s.dispatch.setUserBlocks)
  const setUserBlocks = React.useCallback(
    (newBlocks: NewBlocksMap) => {
      // Convert our state block array to action payload.
      const blocks = [...newBlocks.entries()]
        .filter(
          ([_, userBlocks]) => userBlocks.chatBlocked !== undefined || userBlocks.followBlocked !== undefined
        )
        .map(([username, userBlocks]) => ({
          setChatBlock: userBlocks.chatBlocked,
          setFollowBlock: userBlocks.followBlocked,
          username,
        }))
      if (blocks.length) {
        _setUserBlocks(blocks)
      }
    },
    [_setUserBlocks]
  )

  const props = {
    ...stateProps,
    isBlocked: (username: string, which: BlockType) => {
      const blockObj = stateProps._allKnownBlocks.get(username)
      return blockObj ? blockObj[which] : false
    },
    onClose,
    onFinish: (newBlocks: NewBlocksMap, blockTeam: boolean) => {
      let takingAction = false
      if (blockTeam) {
        const { teamname } = stateProps
        if (teamname) {
          takingAction = true
          leaveTeamAndBlock(teamname)
        } else if (stateProps.convID) {
          takingAction = true
          const anyReported = [...newBlocks.values()].some(v => v.report !== undefined)
          setConversationStatus(anyReported)
        }
      }
      if (newBlocks.size) {
        takingAction = true
        setUserBlocks(newBlocks)
      }
      newBlocks.forEach(
        ({ report }, username) => report && reportUser(username, stateProps.convID, report)
      )
      if (!takingAction) {
        onClose()
      }
    },
    refreshBlocks: () => {
      const usernames = [
        ...(stateProps.adderUsername ? [stateProps.adderUsername] : []),
        ...(stateProps.otherUsernames || []),
      ]
      if (usernames.length) {
        refreshBlocksFor(usernames)
      }
    },
  }

  return <BlockModal {...props} />
}
export default Container
