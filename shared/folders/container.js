// @flow
import Folders from '.'
import pausableConnect from '../util/pausable-connect'
import {favoriteList} from '../actions/favorite'
import {openInKBFS} from '../actions/kbfs'
import {openTlfInChat} from '../actions/chat'
import {compose, lifecycle, withProps} from 'recompose'
import flags from '../util/feature-flags'
import {settingsTab} from '../constants/tabs'
import {switchTo, navigateAppend, navigateTo} from '../actions/route-tree'

import type {RouteProps} from '../route-tree/render-route'
import type {TypedState} from '../constants/reducer'

type FoldersRouteProps = RouteProps<{}, {showingIgnored: boolean}>
type OwnProps = FoldersRouteProps & {showingPrivate: boolean}

const mapStateToProps = (state: TypedState, {routeState, showingPrivate}: OwnProps) => ({
  ...((state.favorite && state.favorite.folderState) || {}),
  showingIgnored: !!state.favorite && routeState.showingIgnored,
  showingPrivate: !!state.favorite && showingPrivate,
  username: state.config.username || '',
})

const mapDispatchToProps = (dispatch: any, {routePath, routeState, setRouteState}: OwnProps) => ({
  favoriteList: () => dispatch(favoriteList()),
  onChat: tlf => dispatch(openTlfInChat(tlf)),
  onClick: path => dispatch(navigateAppend([{props: {path}, selected: 'files'}])),
  onOpen: path => dispatch(openInKBFS(path)),
  onRekey: path => dispatch(navigateAppend([{props: {path}, selected: 'files'}])),
  onSwitchTab: showingPrivate =>
    dispatch(switchTo(routePath.pop().push(showingPrivate ? 'private' : 'public'))),
  onToggleShowIgnored: () => setRouteState({showingIgnored: !routeState.showingIgnored}),
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
