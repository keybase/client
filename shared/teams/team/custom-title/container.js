// @flow
import * as Constants from '../../../constants/teams'
import * as KBFSGen from '../../../actions/kbfs-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import Title from '.'
import {connect, type TypedState} from '../../../util/container'
import {navigateAppend} from '../../../actions/route-tree'
import {teamsTab} from '../../../constants/tabs'

const mapStateToProps = (state: TypedState, {teamname}) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    canChat: !yourOperations.joinTeam,
    canViewFolder: !yourOperations.joinTeam,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {teamname}) => ({
  onChat: () => dispatch(Chat2Gen.createStartConversation({teamname})),
  onOpenFolder: () => dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
  onShowMenu: target =>
    dispatch(
      navigateAppend(
        [
          {
            props: {
              position: 'bottom left',
              targetRect: target && target.getBoundingClientRect(),
              teamname,
            },
            selected: 'menu',
          },
        ],
        [teamsTab, 'team']
      )
    ),
})

const mergeProps = (stateProps, dispatchProps) => ({
  canChat: stateProps.canChat,
  canViewFolder: stateProps.canViewFolder,
  onChat: dispatchProps.onChat,
  onOpenFolder: dispatchProps.onOpenFolder,
  onShowMenu: dispatchProps.onShowMenu,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Title)
