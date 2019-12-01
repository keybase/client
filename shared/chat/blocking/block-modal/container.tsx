import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import BlockModal, {BlockType, NewBlocksMap, ReportSettings} from '.'
import * as UsersGen from '../../../actions/users-gen'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Constants from '../../../constants/users'
import {leaveTeamWaitingKey} from '../../../constants/teams'

type OwnProps = Container.RouteProps<{
  blockByDefault?: boolean
  convID?: string
  others?: Array<string>
  team?: string
  username: string
}>

const Connect = Container.connect(
  (state, ownProps: OwnProps) => {
    const teamname = Container.getRouteProps(ownProps, 'team', undefined)
    const waitingForLeave = teamname ? Container.anyWaiting(state, leaveTeamWaitingKey(teamname)) : false
    const waitingForBlocking = Container.anyWaiting(state, Constants.setUserBlocksWaitingKey)
    const waitingForReport = Container.anyWaiting(state, Constants.reportUserWaitingKey)
    const others = Container.getRouteProps(ownProps, 'others', undefined)

    return {
      _allKnownBlocks: state.users.blockMap,
      adderUsername: Container.getRouteProps(ownProps, 'username', ''),
      blockByDefault: Container.getRouteProps(ownProps, 'blockByDefault', false),
      convID: Container.getRouteProps(ownProps, 'convID', undefined),
      finishWaiting: waitingForLeave || waitingForBlocking || waitingForReport,
      loadingWaiting: Container.anyWaiting(state, Constants.getUserBlocksWaitingKey),
      otherUsernames: others && others.length > 0 ? others : undefined,
      teamname,
    }
  },
  dispatch => ({
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
    _reportUser: (username: string, convID: string | undefined, report: ReportSettings) => {
      dispatch(
        UsersGen.createReportUser({
          comment: report.extraNotes,
          convID: convID || null,
          includeTranscript: report.includeTranscript,
          reason: report.reason,
          username: username,
        })
      )
    },
    _setUserBlocks: (newBlocks: NewBlocksMap) => {
      // Convert our state block array to action payload.
      const blocks = Array.from(newBlocks).map(([username, blocks]) => ({
        setChatBlock: blocks.chatBlocked,
        setFollowBlock: blocks.followBlocked,
        username,
      }))
      dispatch(UsersGen.createSetUserBlocks({blocks}))
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    return {
      ...stateProps,
      isBlocked: (username: string, which: BlockType) => {
        const blockObj = stateProps._allKnownBlocks.get(username)
        return blockObj ? blockObj[which] : false
      },
      onClose: dispatchProps._close,
      onFinish: (newBlocks: NewBlocksMap, blockTeam: boolean, report?: ReportSettings) => {
        if (blockTeam) {
          const {teamname} = stateProps
          if (teamname) {
            dispatchProps._leaveTeamAndBlock(teamname)
          }
        }
        if (newBlocks.size) {
          dispatchProps._setUserBlocks(newBlocks)
        }
        if (report) {
          dispatchProps._reportUser(stateProps.adderUsername, stateProps.convID, report)
        }
      },
      refreshBlocks: () => {
        const usernames = [stateProps.adderUsername].concat(stateProps.otherUsernames || [])
        if (usernames.length) {
          dispatchProps._refreshBlocksFor(usernames)
        }
      },
    }
  }
)

export default Connect(BlockModal)
