import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/users'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as TeamsGen from '../../../actions/teams-gen'
import * as UsersGen from '../../../actions/users-gen'
import * as React from 'react'
import BlockModal, {type BlockType, type NewBlocksMap, type ReportSettings} from '.'
import {leaveTeamWaitingKey} from '../../../constants/teams'

type OwnProps = Container.RouteProps2<'chatBlockingModal'>

export default (ownProps: OwnProps) => {
  const {params} = ownProps.route
  const {context, convID} = params
  const teamname = params.team
  const blockUserByDefault = params.blockUserByDefault ?? false
  let others = params.others
  let adderUsername = params.username
  const waitingForLeave = Container.useSelector(state =>
    teamname ? Container.anyWaiting(state, leaveTeamWaitingKey(teamname)) : false
  )
  const waitingForBlocking = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.setUserBlocksWaitingKey)
  )
  const waitingForReport = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.reportUserWaitingKey)
  )
  if (others?.length === 1 && !adderUsername) {
    adderUsername = others[0]
    others = undefined
  }

  const _allKnownBlocks = Container.useSelector(state => state.users.blockMap)
  const loadingWaiting = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.getUserBlocksWaitingKey)
  )
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

  const onClose = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateUp())
  }, [dispatch])
  const leaveTeamAndBlock = React.useCallback(
    (teamname: string) => {
      dispatch(
        TeamsGen.createLeaveTeam({
          context: 'chat',
          permanent: true,
          teamname,
        })
      )
    },
    [dispatch]
  )
  const refreshBlocksFor = React.useCallback(
    (usernames: Array<string>) => {
      dispatch(UsersGen.createGetBlockState({usernames}))
    },
    [dispatch]
  )
  const reportUser = React.useCallback(
    (username: string, convID: string | undefined, report: ReportSettings) => {
      dispatch(
        UsersGen.createReportUser({
          comment: report.extraNotes,
          convID: convID || null,
          includeTranscript: report.includeTranscript && !!convID,
          reason: report.reason,
          username: username,
        })
      )
    },
    [dispatch]
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
        dispatch(UsersGen.createSetUserBlocks({blocks}))
      }
    },
    [dispatch]
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
