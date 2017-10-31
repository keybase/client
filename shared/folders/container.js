// @flow
import Folders from '.'
import flags from '../util/feature-flags'
import {pausableConnect, compose, lifecycle, withProps, type TypedState} from '../util/container'
import {favoriteList} from '../actions/favorite'
import {openInKBFS} from '../actions/kbfs'
import {createOpenTlfInChat} from '../actions/chat-gen'
import {settingsTab} from '../constants/tabs'
import {switchTo, navigateAppend, navigateTo} from '../actions/route-tree'
import {type RouteProps} from '../route-tree/render-route'

type FoldersRouteProps = RouteProps<{}, {showingIgnored: boolean}>
type OwnProps = FoldersRouteProps & {showingPrivate: boolean}

const mapStateToProps = (state: TypedState, {routeState, showingPrivate}: OwnProps) => ({
  ...((state.favorite && state.favorite.folderState) || {}),
  showingIgnored: !!state.favorite && routeState.get('showingIgnored'),
  showingPrivate: !!state.favorite && showingPrivate,
  username: state.config.username || '',
})

const mapDispatchToProps = (dispatch: any, {routePath, routeState, setRouteState}: OwnProps) => ({
  favoriteList: () => dispatch(favoriteList()),
  onChat: tlf => dispatch(createOpenTlfInChat({tlf})),
  onClick: path => dispatch(navigateAppend([{props: {path}, selected: 'files'}])),
  onOpen: path => dispatch(openInKBFS(path)),
  onRekey: path => dispatch(navigateAppend([{props: {path}, selected: 'files'}])),
  onSwitchTab: showingPrivate =>
    dispatch(switchTo(routePath.pop().push(showingPrivate ? 'private' : 'public'))),
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
  showingPrivate: true,
})(ConnectedFolders)

const PublicFolders = withProps({
  showingPrivate: false,
})(ConnectedFolders)

export {PrivateFolders, PublicFolders}
