// @flow
// This HOC wraps a RemoteWindow so it can send avatar related props
// It listens for avatar related actions and bookkeeps them to send them back over the wire
import * as ConfigGen from '../../actions/config-gen'
import * as I from 'immutable'
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {pick} from 'lodash-es'
import {compose, connect, withStateHandlers, type TypedState} from '../../util/container'
import memoize from 'memoize-one'

type Props = {
  avatars: Object,
  followers: Array<string>,
  following: Array<string>,
  remoteWindow: ?SafeElectron.BrowserWindowType,
  setUsernames: (I.Set<string>) => void,
  usernames: I.Set<string>,
  windowComponent: string,
  windowParam: string,
}

export const serialize = {
  avatars: (v, o) => v,
  followers: (v, o) => v,
  following: (v, o) => v,
}

const initialState = {
  config: {
    avatars: {},
    followers: I.Set(),
    following: I.Set(),
  },
}
export const deserialize = (state: any = initialState, props: any) => {
  if (!props) return state
  return {
    ...state,
    config: {
      avatars: {
        ...state.config.avatars,
        ...props.avatars,
      },
      followers: I.Set(props.followers),
      following: I.Set(props.following),
    },
  }
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
      const {setUsernames, usernames, ...rest} = this.props
      return <ComposedComponent {...rest} />
    }
  }

  const mapStateToProps = (state: TypedState) => ({
    avatars: state.config.avatars,
    followers: state.config.followers,
    following: state.config.following,
  })

  const getRemoteAvatars = memoize((avatars, usernames) => pick(avatars, usernames.toArray()))
  const getRemoteFollowers = memoize((followers, usernames) => followers.intersect(usernames).toArray())
  const getRemoteFollowing = memoize((following, usernames) => following.intersect(usernames).toArray())

  const mergeProps = (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    avatars: getRemoteAvatars(stateProps.avatars, ownProps.usernames),
    followers: getRemoteFollowers(stateProps.followers, ownProps.usernames),
    following: getRemoteFollowing(stateProps.following, ownProps.usernames),
  })

  return compose(
    withStateHandlers({usernames: I.Set()}, {setUsernames: () => usernames => ({usernames})}),
    connect(mapStateToProps, () => ({}), mergeProps)
  )(RemoteAvatarConnected)
}

export default SyncAvatarProps
