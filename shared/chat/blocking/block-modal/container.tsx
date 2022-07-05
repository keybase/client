import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import BlockModal, {BlockType, NewBlocksMap, ReportSettings, BlockModalContext} from '.'
import * as UsersGen from '../../../actions/users-gen'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/users'
import {leaveTeamWaitingKey} from '../../../constants/teams'

type OwnProps = Container.RouteProps<{
  blockUserByDefault?: boolean
  context?: BlockModalContext
  convID?: string
  others?: Array<string>
  team?: string
  username?: string
}>

export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const teamname = Container.getRouteProps(ownProps, 'team', undefined)
    const waitingForLeave = teamname ? Container.anyWaiting(state, leaveTeamWaitingKey(teamname)) : false
    const waitingForBlocking = Container.anyWaiting(state, Constants.setUserBlocksWaitingKey)
    const waitingForReport = Container.anyWaiting(state, Constants.reportUserWaitingKey)
    let others = Container.getRouteProps(ownProps, 'others', undefined)
    let adderUsername = Container.getRouteProps(ownProps, 'username', undefined)
    if (others?.length === 1 && !adderUsername) {
      adderUsername = others[0]
      others = undefined
    }

    return {
      _allKnownBlocks: state.users.blockMap,
      adderUsername,
      blockUserByDefault: Container.getRouteProps(ownProps, 'blockUserByDefault', false),
      context: Container.getRouteProps(ownProps, 'context', undefined),
      convID: Container.getRouteProps(ownProps, 'convID', undefined),
      finishWaiting: waitingForLeave || waitingForBlocking || waitingForReport,
      loadingWaiting: Container.anyWaiting(state, Constants.getUserBlocksWaitingKey),
      otherUsernames: others && others.length > 0 ? others : undefined,
      teamname,
    }
  },
  (dispatch: Container.TypedDispatch) => ({
    _close: () => dispatch(RouteTreeGen.createNavigateUp()),
    _leaveTeamAndBlock: (teamname: string) =>
      dispatch(
        TeamsGen.createLeaveTeam({
          context: 'chat',
          permanent: true,
          teamname,
        })
      ),
    _refreshBlocksFor: (usernames: Array<string>) => dispatch(UsersGen.createGetBlockState({usernames})),
    _reportUser: (username: string, convID: string | undefined, report: ReportSettings) =>
      dispatch(
        UsersGen.createReportUser({
          comment: report.extraNotes,
          convID: convID || null,
          includeTranscript: report.includeTranscript && !!convID,
          reason: report.reason,
          username: username,
        })
      ),
    _setConversationStatus: (conversationIDKey: string, reportUser: boolean) =>
      dispatch(
        Chat2Gen.createBlockConversation({
          conversationIDKey,
          reportUser,
        })
      ),
    _setUserBlocks: (newBlocks: NewBlocksMap) => {
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
      if (blocks && blocks.length) {
        dispatch(UsersGen.createSetUserBlocks({blocks}))
      }
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    isBlocked: (username: string, which: BlockType) => {
      const blockObj = stateProps._allKnownBlocks.get(username)
      return blockObj ? blockObj[which] : false
    },
    onClose: dispatchProps._close,
    onFinish: (newBlocks: NewBlocksMap, blockTeam: boolean) => {
      let takingAction = false
      if (blockTeam) {
        const {teamname} = stateProps
        if (teamname) {
          takingAction = true
          dispatchProps._leaveTeamAndBlock(teamname)
        } else if (stateProps.convID) {
          takingAction = true
          const anyReported = [...newBlocks.values()].some(v => v?.report !== undefined)
          dispatchProps._setConversationStatus(stateProps.convID, anyReported)
        }
      }
      if (newBlocks.size) {
        takingAction = true
        dispatchProps._setUserBlocks(newBlocks)
      }
      newBlocks.forEach(
        ({report}, username) => report && dispatchProps._reportUser(username, stateProps.convID, report)
      )
      if (!takingAction) {
        dispatchProps._close()
      }
    },
    refreshBlocks: () => {
      const usernames = [
        ...(stateProps.adderUsername ? [stateProps.adderUsername] : []),
        ...(stateProps.otherUsernames || []),
      ]
      if (usernames.length) {
        dispatchProps._refreshBlocksFor(usernames)
      }
    },
  })
)(BlockModal)
