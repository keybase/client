// @flow
import Push from './push/push.native'
import React, {Component} from 'react'
import RenderRoute from '../route-tree/render-route'
import loadPerf from '../util/load-perf'
import hello from '../util/hello'
import {bootstrap, persistRouteState} from '../actions/config'
import {connect, type TypedState} from '../util/container'
import debounce from 'lodash/debounce'
import {getUserImageMap, loadUserImageMap, getTeamImageMap, loadTeamImageMap} from '../util/pictures'
import {initAvatarLookup, initAvatarLoad} from '../common-adapters/index.native'
import {listenForNotifications} from '../actions/notifications'
import {navigateUp, setRouteState} from '../actions/route-tree'

type Props = {
  folderBadge: number,
  mountPush: boolean,
  routeDef: any,
  routeState: any,
  showPushPrompt: any,
  bootstrap: () => void,
  hello: () => void,
  listenForNotifications: () => void,
  persistRouteState: () => void,
  setRouteState: (path: any, partialState: any) => void,
  navigateUp: () => void,
}

type OwnProps = {
  platform: string,
  version: string,
}

class Main extends Component<any> {
  constructor(props: Props) {
    super(props)

    if (!global.mainLoaded) {
      global.mainLoaded = true
      initAvatarLookup(getUserImageMap, getTeamImageMap)
      initAvatarLoad(loadUserImageMap, loadTeamImageMap)

      this.props.bootstrap()
      this.props.listenForNotifications()
      this.props.hello()
      loadPerf()
    }
  }

  _persistRoute = debounce(() => {
    this.props.persistRouteState()
  }, 200)

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.routeState !== nextProps.routeState) {
      this._persistRoute()
    }
  }

  render() {
    // TODO: move Push prompt into route
    if (this.props.showPushPrompt) {
      return <Push />
    }

    return (
      <RenderRoute
        routeDef={this.props.routeDef}
        routeState={this.props.routeState}
        setRouteState={this.props.setRouteState}
      />
    )
  }
}

const mapStateToProps = (state: TypedState) => ({
  folderBadge: state.favorite.folderState.privateBadge + state.favorite.folderState.publicBadge,
  routeDef: state.routeTree.routeDef,
  routeState: state.routeTree.routeState,
  showPushPrompt: state.push.permissionsPrompt,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  bootstrap: () => dispatch(bootstrap()),
  hello: () => hello(0, ownProps.platform, [], ownProps.version, true), // TODO real version
  listenForNotifications: () => dispatch(listenForNotifications()),
  navigateUp: () => {
    dispatch(navigateUp())
  },
  persistRouteState: () => dispatch(persistRouteState),
  setRouteState: (path, partialState) => {
    dispatch(setRouteState(path, partialState))
  },
})

const connector = connect(mapStateToProps, mapDispatchToProps)

export {connector, Main}
