// @flow
// This HOC wraps a RemoteWindow so it can send avatar related props
// It listens for avatar related actions and bookkeeps them to send them back over the wire
import * as ConfigGen from '../../actions/config-gen'
import * as I from 'immutable'
import * as React from 'react'
import {ipcRenderer, remote} from 'electron'
import pick from 'lodash/pick'
import {compose, connect, withState, type TypedState} from '../../util/container'

const BrowserWindow = remote.BrowserWindow

type Props = {
  _allAvatars: Object,
  _avatars: Object,
  selectorParams: ?string,
  component: string,
  remoteWindow: ?BrowserWindow,
  setUsernames: I.Set<string> => void,
  usernames: I.Set<string>,
}

function SyncAvatarProps(ComposedComponent: any) {
  class RemoteAvatarConnected extends React.PureComponent<Props> {
    _onRemoteActionFired = (
      event: any,
      action: {type: string, payload: Object},
      component: string,
      selectorParams: ?string
    ) => {
      if (component === this.props.component && selectorParams === this.props.selectorParams) {
        if (action.type === ConfigGen.loadAvatars) {
          const {usernames} = action.payload
          this.props.setUsernames(this.props.usernames.add(usernames))
        } else if (action.type === ConfigGen.loadTeamAvatars) {
          const {teamnames} = action.payload
          this.props.setUsernames(this.props.usernames.add(teamnames))
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
      const {_allAvatars, _avatars, ...props} = this.props
      const config = {
        avatars: _avatars,
      }
      return <ComposedComponent {...props} config={config} />
    }
  }

  const mapStateToProps = (state: TypedState) => ({
    _allAvatars: state.config.avatars,
  })

  const mergeProps = (stateProps, dispatchProps, ownProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    _avatars: pick(stateProps._allAvatars, ownProps.usernames.toArray()),
  })

  return compose(
    withState('usernames', 'setUsernames', I.Set()),
    connect(mapStateToProps, () => ({}), mergeProps)
  )(RemoteAvatarConnected)
}

export default SyncAvatarProps
