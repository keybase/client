// @flow
import {isLinux} from '../constants/platform'
import Folders, {type FolderType} from '.'
import * as ChatGen from '../actions/chat-gen'
import * as KBFSGen from '../actions/kbfs-gen'
import * as FavoriteGen from '../actions/favorite-gen'
import flags from '../util/feature-flags'
import {pausableConnect, compose, lifecycle, withProps, type TypedState} from '../util/container'
import {settingsTab} from '../constants/tabs'
import {switchTo, navigateAppend, navigateTo} from '../actions/route-tree'
import {type RouteProps} from '../route-tree/render-route'

type FoldersRouteProps = RouteProps<{}, {showingIgnored: boolean}>
type OwnProps = FoldersRouteProps & {selected: FolderType}

const mapStateToProps = (state: TypedState, {routeState, selected}: OwnProps) => {
  const installed = isLinux || (state.favorite.fuseStatus && state.favorite.fuseStatus.kextStarted)
  return {
    ...((state.favorite && state.favorite.folderState) || {}),
    installed,
    showingIgnored: !!state.favorite && routeState.get('showingIgnored'),
    selected: !!state.favorite && selected,
    username: state.config.username || '',
    showSecurityPrefs: !installed && state.favorite.kextPermissionError,
  }
}

const mapDispatchToProps = (dispatch: any, {routePath, routeState, setRouteState, isTeam}: OwnProps) => ({
  fuseStatus: () => dispatch(KBFSGen.createFuseStatus()),
  favoriteList: () => dispatch(FavoriteGen.createFavoriteList()),
  onChat: (tlf, isTeam?) => dispatch(ChatGen.createOpenTlfInChat({tlf, isTeam})),
  onClick: path => dispatch(navigateAppend([{props: {path}, selected: 'files'}])),
  onOpen: path => dispatch(KBFSGen.createOpen({path})),
  onRekey: path => dispatch(navigateAppend([{props: {path}, selected: 'files'}])),
  onSwitchTab: selected => dispatch(switchTo(routePath.pop().push(selected))),
  onToggleShowIgnored: () => setRouteState({showingIgnored: !routeState.get('showingIgnored')}),
  ...(flags.teamChatEnabled
    ? {
        onBack: () => dispatch(navigateTo([settingsTab], [])),
      }
    : {}),
})

const ConnectedFolders = compose(
  pausableConnect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
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
