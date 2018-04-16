// @flow
import * as Constants from '../../../constants/teams'
import * as KBFSGen from '../../../actions/kbfs-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import Title from '.'
import {connect, type TypedState} from '../../../util/container'
import {navigateAppend} from '../../../actions/route-tree'
import {teamsTab} from '../../../constants/tabs'

const mapStateToProps = (state: TypedState, {teamname}) => ({
  _yourOperations: Constants.getCanPerform(state, teamname),
})

const mapDispatchToProps = (dispatch: Dispatch, {teamname}) => ({
  onChat: () => dispatch(Chat2Gen.createStartConversation({tlf: `/keybase/team/${teamname}`})),
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
  canChat: !stateProps._yourOperations.joinTeam,
  canViewFolder: !stateProps._yourOperations.joinTeam,
  onChat: dispatchProps.onChat,
  onOpenFolder: dispatchProps.onOpenFolder,
  onShowMenu: dispatchProps.onShowMenu,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Title)
