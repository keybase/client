import * as C from '@/constants'
import * as Constants from '@/constants/users'
import * as React from 'react'
import BlockModal, {type BlockModalContext, type BlockType, type NewBlocksMap, type ReportSettings} from '.'

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
  const {context, conversationIDKey, blockUserByDefault = false, filterUserByDefault = false} = ownProps
  const {flagUserByDefault = false, reportsUserByDefault = false, team: teamname} = ownProps
  let {username: adderUsername, others} = ownProps
  const waitingForLeave = C.Waiting.useAnyWaiting(
    teamname ? C.Teams.leaveTeamWaitingKey(teamname) : undefined
  )
  const waitingForBlocking = C.Waiting.useAnyWaiting(Constants.setUserBlocksWaitingKey)
  const waitingForReport = C.Waiting.useAnyWaiting(Constants.reportUserWaitingKey)
  if (others?.length === 1 && !adderUsername) {
    adderUsername = others[0]
    others = undefined
  }

  const _allKnownBlocks = C.useUsersState(s => s.blockMap)
  const loadingWaiting = C.Waiting.useAnyWaiting(Constants.getUserBlocksWaitingKey)

  const onClose = C.useRouterState(s => s.dispatch.navigateUp)
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

  const otherUsernames = others && others.length > 0 ? others : undefined
  const props = {
    adderUsername,
    blockUserByDefault,
    context,
    conversationIDKey,
    filterUserByDefault,
    finishWaiting: waitingForLeave || waitingForBlocking || waitingForReport,
    flagUserByDefault,
    isBlocked: (username: string, which: BlockType) => {
      const blockObj = _allKnownBlocks.get(username)
      return blockObj ? blockObj[which] : false
    },
    loadingWaiting,
    onClose,
    onFinish: (newBlocks: NewBlocksMap, blockTeam: boolean) => {
      let takingAction = false
      if (blockTeam) {
        if (teamname) {
          takingAction = true
          leaveTeamAndBlock(teamname)
        } else if (conversationIDKey) {
          takingAction = true
          const anyReported = [...newBlocks.values()].some(v => v.report !== undefined)
          setConversationStatus(anyReported)
        }
      }
      if (newBlocks.size) {
        takingAction = true
        setUserBlocks(newBlocks)
      }
      newBlocks.forEach(({report}, username) => report && reportUser(username, conversationIDKey, report))
      if (!takingAction) {
        onClose()
      }
    },
    otherUsernames,
    refreshBlocks: () => {
      const usernames = [...(adderUsername ? [adderUsername] : []), ...(otherUsernames || [])]
      if (usernames.length) {
        refreshBlocksFor(usernames)
      }
    },
    reportsUserByDefault,
    teamname,
  }

  return <BlockModal {...props} />
}
export default Container
