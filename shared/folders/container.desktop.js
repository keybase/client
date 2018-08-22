// @flow
import Folders, {type FolderType} from './index.desktop'
import * as Chat2Gen from '../actions/chat2-gen'
import * as KBFSGen from '../actions/kbfs-gen'
import * as FavoriteGen from '../actions/favorite-gen'
import {connect, compose, lifecycle, withProps, type TypedState} from '../util/container'
import {settingsTab} from '../constants/tabs'
import {switchTo, navigateAppend, navigateTo} from '../actions/route-tree'
import {type RouteProps} from '../route-tree/render-route'
import {tlfToParticipantsOrTeamname} from '../util/kbfs'

type FoldersRouteProps = RouteProps<{}, {showingIgnored: boolean}>
type OwnProps = FoldersRouteProps & {selected: FolderType}

const mapStateToProps = (state: TypedState, {routeState, selected}: OwnProps) => {
  return {
    ...((state.favorite && state.favorite.folderState) || {}),
    showingIgnored: !!state.favorite && routeState.get('showingIgnored'),
    selected: !!state.favorite && selected,
    username: state.config.username || '',
  }
}

const mapDispatchToProps = (dispatch: any, {routePath, routeState, setRouteState, isTeam}: OwnProps) => ({
  fuseStatus: () => dispatch(KBFSGen.createFuseStatus()),
  favoriteList: () => dispatch(FavoriteGen.createFavoriteList()),
  onChat: tlf => {
    const {participants, teamname} = tlfToParticipantsOrTeamname(tlf)
    if (participants) {
      dispatch(Chat2Gen.createPreviewConversation({participants, reason: 'files'}))
    } else if (teamname) {
      dispatch(Chat2Gen.createPreviewConversation({teamname, reason: 'files'}))
    }
  },
  onClick: path => dispatch(navigateAppend([{props: {path}, selected: 'files'}])),
  onOpen: path => dispatch(KBFSGen.createOpen({path})),
  onRekey: path => dispatch(navigateAppend([{props: {path}, selected: 'files'}])),
  onSwitchTab: selected => dispatch(switchTo(routePath.pop().push(selected))),
  onToggleShowIgnored: () => setRouteState({showingIgnored: !routeState.get('showingIgnored')}),
  onBack: () => dispatch(navigateTo([settingsTab], [])),
})

const ConnectedFolders = compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  lifecycle({
    componentDidMount() {
      this.props.favoriteList()
    },
  })
)(Folders)

const PrivateFolders = withProps({
  selected: 'private',
})(ConnectedFolders)

const PublicFolders = withProps({
  selected: 'public',
})(ConnectedFolders)

const TeamFolders = withProps({
  selected: 'team',
})(ConnectedFolders)

export {PrivateFolders, PublicFolders, TeamFolders}
