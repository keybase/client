import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import BlockModal, {BlockType, NewBlocksMap, ReportSettings} from '.'
import * as UsersGen from '../../../actions/users-gen'
import * as TeamsGen from '../../../actions/teams-gen'

type OwnProps = Container.RouteProps<{
  blockByDefault?: boolean
  convID?: string
  others?: Array<string>
  team?: string
  username: string
}>

const Connect = Container.connect(
  (state, ownProps: OwnProps) => ({
    adderUsername: Container.getRouteProps(ownProps, 'username', ''),
    blockByDefault: Container.getRouteProps(ownProps, 'blockByDefault', false),
    convID: Container.getRouteProps(ownProps, 'convID', undefined),
    isBlocked: (username: string, which: BlockType) => {
      const blockObj = state.users.blockMap.get(username)
      return blockObj ? blockObj[which] : false
    },
    others: Container.getRouteProps(ownProps, 'others', undefined),
    teamname: Container.getRouteProps(ownProps, 'team', undefined),
  }),
  dispatch => ({
    _leaveTeamAndBlock: (teamname: string) => dispatch(TeamsGen.createLeaveTeam({context: 'chat', teamname})),
    _refreshBlocksFor: (usernames: Array<string>) => dispatch(UsersGen.createGetBlockState({usernames})),
    _setUserBlocks: (newBlocks: NewBlocksMap) => {
      // Convert our state block array to action payload.
      const blocks = Array.from(newBlocks).map(([username, blocks]) => ({
        setChatBlock: blocks.chatBlocked,
        setFollowBlock: blocks.followBlocked,
        username,
      }))
      dispatch(UsersGen.createSetUserBlocks({blocks}))
    },
    _reportUser: (username: string, convID: string | undefined, report: ReportSettings) => {
      dispatch(
        UsersGen.createReportUser({
          comment: report.extraNotes,
          convID: (report.includeTranscript && convID) || null,
          includeTranscript: report.includeTranscript,
          reason: report.reason,
          username: username,
        })
      )
    },
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    return {
      ...stateProps,
      onCancel: dispatchProps.onCancel,
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
        const usernames = [stateProps.adderUsername].concat(stateProps.others || [])
        if (usernames.length) {
          dispatchProps._refreshBlocksFor(usernames)
        }
      },
    }
  }
)

export default Connect(BlockModal)
