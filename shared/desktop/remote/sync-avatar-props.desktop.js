// @flow
// This HOC wraps a RemoteWindow so it can send avatar related props
// It listens for avatar related actions and bookkeeps them to send them back over the wire
import * as ConfigGen from '../../actions/config-gen'
import * as I from 'immutable'
import * as React from 'react'
import {ipcRenderer, remote} from 'electron'
import {pick} from 'lodash-es'
import {compose, connect, withStateHandlers, type TypedState} from '../../util/container'

const BrowserWindow = remote.BrowserWindow

type Props = {
  avatars: Object,
  followers: Array<string>,
  following: Array<string>,
  remoteWindow: ?BrowserWindow,
  setUsernames: (I.Set<string>) => void,
  usernames: I.Set<string>,
  windowComponent: string,
  windowParam: string,
}

function SyncAvatarProps(ComposedComponent: any) {
  class RemoteAvatarConnected extends React.PureComponent<Props> {
    _onRemoteActionFired = (
      event: any,
      action: {type: string, payload: Object},
      windowComponent: string,
      windowParam: string
    ) => {
      if (windowComponent === this.props.windowComponent && windowParam === this.props.windowParam) {
        if (action.type === ConfigGen.loadAvatars) {
          const {usernames} = action.payload
          this.props.setUsernames(this.props.usernames.concat(usernames))
        } else if (action.type === ConfigGen.loadTeamAvatars) {
          const {teamnames} = action.payload
          this.props.setUsernames(this.props.usernames.concat(teamnames))
        }
      }
    }

    componentDidMount() {
      ipcRenderer.on('dispatchAction', this._onRemoteActionFired)
    }
    componentWillUnmount() {
      ipcRenderer.removeListener('dispatchAction', this._onRemoteActionFired)
    }

    render() {
      // Don't send our internal props forward
      const {avatars, following, followers, setUsernames, usernames, ...rest} = this.props
      const config = {avatars, followers, following}
      return <ComposedComponent {...rest} config={config} />
    }
  }

  const mapStateToProps = (state: TypedState) => ({
    _allAvatars: state.config.avatars,
    _allFollowers: state.config.followers,
    _allFollowing: state.config.following,
  })

  const mergeProps = (stateProps, dispatchProps, ownProps) => {
    return {
      ...dispatchProps,
      ...ownProps,
      avatars: pick(stateProps._allAvatars, ownProps.usernames.toArray()),
      followers: stateProps._allFollowers.intersect(ownProps.usernames).toArray(),
      following: stateProps._allFollowing.intersect(ownProps.usernames).toArray(),
    }
  }

  return compose(
    withStateHandlers({usernames: I.Set()}, {setUsernames: () => usernames => ({usernames})}),
    connect(mapStateToProps, () => ({}), mergeProps)
  )(RemoteAvatarConnected)
}

export default SyncAvatarProps
