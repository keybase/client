// @flow
// This HOC wraps a RemoteWindow so it can send avatar related props
// It listens for avatar related actions and bookkeeps them to send them back over the wire
import * as ConfigGen from '../../actions/config-gen'
import * as I from 'immutable'
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
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
    return v.toJS()
    // TODO do diff
    const toSend = Object.keys(v).reduce((map, k) => {
      if (!o || v[k] !== o[k]) {
        map[k] = v[k]
      }
      return map
    }, {})
    return Object.keys(toSend).length ? toSend : undefined
  },
  followers: (v: any) => v.toArray(),
  following: (v: any) => v.toArray(),
}

const initialState = {
  config: {
    avatars: I.Map(),
    followers: I.Set(),
    following: I.Set(),
  },
}
export const deserialize = (state: any = initialState, props: any) => {
  if (!props) return state

  const pa = props.avatars || {}
  const arrs = Object.keys(pa).reduce((arr, name) => {
    const sizes = Object.keys(pa[name]).reduce((arr, size) => {
      arr.push([size, pa[name][size]])
      return arr
    }, [])
    arr.push([name, I.Map(sizes)])
    return arr
  }, [])
  return {
    ...state,
    config: {
      ...state.config,
      avatars: (state.config.avatars || I.Map()).merge(I.Map(arrs)),
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

  const getRemoteAvatars = memoize((avatars, usernames) => avatars.filter((_, name) => usernames.has(name)))
  const getRemoteFollowers = memoize((followers, usernames) => followers.intersect(usernames))
  const getRemoteFollowing = memoize((following, usernames) => following.intersect(usernames))

  return compose(
    withStateHandlers({usernames: I.Set()}, {setUsernames: () => usernames => ({usernames})}),
    connect(mapStateToProps, () => ({}), (s, d, o) => ({...o, ...s, ...d}))
  )(RemoteAvatarConnected)
}

export default SyncAvatarProps
