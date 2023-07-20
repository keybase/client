import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/users'
import * as TeamsConstants from '../../../constants/teams'
import * as Container from '../../../util/container'
import * as RouterConstants from '../../../constants/router2'
import * as React from 'react'
import BlockModal, {type BlockModalContext, type BlockType, type NewBlocksMap, type ReportSettings} from '.'
import {leaveTeamWaitingKey} from '../../../constants/teams'

type OwnProps = {
  blockUserByDefault?: boolean
  context?: BlockModalContext
  convID?: string
  others?: Array<string>
  team?: string
  username?: string
}

export default (ownProps: OwnProps) => {
  const {context, convID} = ownProps
  const teamname = ownProps.team
  const blockUserByDefault = ownProps.blockUserByDefault ?? false
  let others = ownProps.others
  let adderUsername = ownProps.username
  const waitingForLeave = Container.useAnyWaiting(teamname ? leaveTeamWaitingKey(teamname) : undefined)
  const waitingForBlocking = Container.useAnyWaiting(Constants.setUserBlocksWaitingKey)
  const waitingForReport = Container.useAnyWaiting(Constants.reportUserWaitingKey)
  if (others?.length === 1 && !adderUsername) {
    adderUsername = others[0]
    others = undefined
  }

  const _allKnownBlocks = Constants.useState(s => s.blockMap)
  const loadingWaiting = Container.useAnyWaiting(Constants.getUserBlocksWaitingKey)
  const stateProps = {
    _allKnownBlocks,
    adderUsername,
    blockUserByDefault,
    context,
    convID,
    finishWaiting: waitingForLeave || waitingForBlocking || waitingForReport,
    loadingWaiting,
    otherUsernames: others && others.length > 0 ? others : undefined,
    teamname,
  }

  const dispatch = Container.useDispatch()

  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onClose = navigateUp
  const leaveTeam = TeamsConstants.useState(s => s.dispatch.leaveTeam)
  const leaveTeamAndBlock = React.useCallback(
    (teamname: string) => {
      leaveTeam(teamname, true, 'chat')
    },
    [leaveTeam]
  )
  const getBlockState = Constants.useState(s => s.dispatch.getBlockState)
  const _reportUser = Constants.useState(s => s.dispatch.reportUser)
  const refreshBlocksFor = getBlockState
  const reportUser = React.useCallback(
    (username: string, convID: string | undefined, report: ReportSettings) => {
      _reportUser({
        comment: report.extraNotes,
        convID,
        includeTranscript: report.includeTranscript && !!convID,
        reason: report.reason,
        username,
      })
    },
    [_reportUser]
  )
  const setConversationStatus = React.useCallback(
    (conversationIDKey: string, reportUser: boolean) => {
      dispatch(
        Chat2Gen.createBlockConversation({
          conversationIDKey,
          reportUser,
        })
      )
    },
    [dispatch]
  )
  const _setUserBlocks = Constants.useState(s => s.dispatch.setUserBlocks)
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
        const {teamname} = stateProps
        if (teamname) {
          takingAction = true
          leaveTeamAndBlock(teamname)
        } else if (stateProps.convID) {
          takingAction = true
          const anyReported = [...newBlocks.values()].some(v => v?.report !== undefined)
          setConversationStatus(stateProps.convID, anyReported)
        }
      }
      if (newBlocks.size) {
        takingAction = true
        setUserBlocks(newBlocks)
      }
      newBlocks.forEach(({report}, username) => report && reportUser(username, stateProps.convID, report))
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
