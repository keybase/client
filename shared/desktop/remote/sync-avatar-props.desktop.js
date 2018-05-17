// @flow
// This HOC wraps a RemoteWindow so it can send avatar related props
// It listens for avatar related actions and bookkeeps them to send them back over the wire
import * as ConfigGen from '../../actions/config-gen'
import * as I from 'immutable'
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {pick} from 'lodash-es'
import {compose, connect, withStateHandlers, type TypedState} from '../../util/container'

type Props = {
  _allAvatars: Object,
  _avatars: Object,
  windowParam: string,
  windowComponent: string,
  remoteWindow: ?SafeElectron.BrowserWindowType,
  setUsernames: (I.Set<string>) => void,
  usernames: I.Set<string>,
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
      SafeElectron.getIpcRenderer().on('dispatchAction', this._onRemoteActionFired)
    }
    componentWillUnmount() {
      SafeElectron.getIpcRenderer().removeListener('dispatchAction', this._onRemoteActionFired)
    }

    render() {
      // Don't send our internal props forward
      const {_allAvatars, _avatars, setUsernames, usernames, ...props} = this.props
      const config = {
        avatars: _avatars,
      }
      return <ComposedComponent {...props} config={config} />
    }
  }

  const mapStateToProps = (state: TypedState) => ({
    _allAvatars: state.config.avatars,
  })

  const mergeProps = (stateProps, dispatchProps, ownProps) => {
    const {_allAvatars, ..._stateProps} = stateProps

    return {
      ..._stateProps,
      ...dispatchProps,
      ...ownProps,
      _avatars: pick(_allAvatars, ownProps.usernames.toArray()),
    }
  }

  return compose(
    withStateHandlers({usernames: I.Set()}, {setUsernames: () => usernames => ({usernames})}),
    connect(mapStateToProps, () => ({}), mergeProps)
  )(RemoteAvatarConnected)
}

export default SyncAvatarProps
