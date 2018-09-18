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
  avatars: (v: any, o: any) => {
    if (!v) return undefined
    const toSend = Object.keys(v).reduce((map, k) => {
      if (!o || v[k] !== o[k]) {
        map[k] = v[k]
      }
      return map
    }, {})
    return Object.keys(toSend).length ? toSend : undefined
  },
  followers: (v: any) => v,
  following: (v: any) => v,
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
      ...state.config,
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

  const mapStateToProps = (state: TypedState, ownProps) => ({
    avatars: getRemoteAvatars(state.config.avatars, ownProps.usernames),
    followers: getRemoteFollowers(state.config.followers, ownProps.usernames),
    following: getRemoteFollowing(state.config.following, ownProps.usernames),
  })

  const getRemoteAvatars = memoize((avatars, usernames) => {
    const a = pick(avatars, usernames.toArray())
    if (Object.keys(a).length === 0) return undefined
    return a
  })
  const getRemoteFollowers = memoize((followers, usernames) => {
    const f = followers.intersect(usernames).toArray()
    if (f.length === 0) return undefined
    return f
  })
  const getRemoteFollowing = memoize((following, usernames) => {
    const f = following.intersect(usernames).toArray()
    if (f.length === 0) return undefined
    return f
  })

  return compose(
    withStateHandlers({usernames: I.Set()}, {setUsernames: () => usernames => ({usernames})}),
    connect(mapStateToProps, () => ({}), (s, d, o) => ({...o, ...s, ...d}))
  )(RemoteAvatarConnected)
}

export default SyncAvatarProps
