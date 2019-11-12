import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import BlockModal, {BlockType, NewBlocksMap} from '.'
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
    leaveTeamAndBlock: (teamname: string) => dispatch(TeamsGen.createLeaveTeam({context: 'chat', teamname})),
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    refreshBlocksFor: (usernames: Array<string>) => dispatch(UsersGen.createGetBlockState({usernames})),
    setUserBlocks: (newBlocks: NewBlocksMap) => {
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
      onCancel: dispatchProps.onCancel,
      onFinish: (newBlocks: NewBlocksMap, blockTeam: boolean) => {
        if (blockTeam) {
          const {teamname} = stateProps
          if (teamname) {
            dispatchProps.leaveTeamAndBlock(teamname)
          }
        }
        if (newBlocks.size) {
          dispatchProps.setUserBlocks(newBlocks)
        }
      },
      refreshBlocks: () => {
        const usernames = [stateProps.adderUsername].concat(stateProps.others || [])
        if (usernames.length) {
          dispatchProps.refreshBlocksFor(usernames)
        }
      },
    }
  }
)

export default Connect(BlockModal)
