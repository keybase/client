// @flow
import React, {Component} from 'react'
import shallowEqual from 'shallowequal'
import {globalStyles, globalColors} from '../styles'
import {isTesting} from '../local-debug'
import {resolveImageAsURL} from '../desktop/resolve-root'

import type {Props, AvatarLookup, AvatarLoad} from './avatar'

const noAvatar = resolveImageAsURL('icons', 'icon-placeholder-avatar-112-x-112@2x.png')
// To convert usernames/uids to avatarurls
let _urlLookup
let _urlLoad

type State = {
  avatarLoaded: boolean,
  errored: boolean,
  url: ?string,
}

// Holds the loaded or errored state. undefined if we don't know. So we can skip trying this on repeat images
const _avatarCache: {[key: string]: ?boolean} = { }

class Avatar extends Component<void, Props, State> {
  state: State;
  _onURLLoaded: ?(username: string, url: ?string) => void;

  constructor (props: Props) {
    super(props)

    const urlState = this._getURLState(props)
    this.state = {
      ...this._getLoadedErrorState(urlState.url),
      ...urlState,
    }
  }

  componentDidMount () {
    this._onURLLoaded = (username: string, url: ?string) => {
      if (this.props.username === username) {
        this.setState({url})
      }
    }
  }

  componentWillUnmount () {
    this._onURLLoaded = null
  }

  _getURLState (props) {
    if (__SCREENSHOT__ || isTesting) {
      return {url: null}
    }

    if (props.url) {
      return {url: props.url}
    }

    if (props.username && _urlLookup) {
      const resolvedUrl = _urlLookup(props.username)

      if (resolvedUrl) {
        return {url: resolvedUrl}
      }

      if (_urlLoad && props.username) {
        _urlLoad(props.username, (username: string, url: ?string) => {
          this._onURLLoaded && this._onURLLoaded(username, url)
        })
      }
    }

    return {url: null}
  }

  _getLoadedErrorState (url: ?string) {
    return {
      avatarLoaded: !!url && _avatarCache.hasOwnProperty(url) && !!_avatarCache[url],
      errored: !!url && _avatarCache.hasOwnProperty(url) && !_avatarCache[url],
    }
  }

  shouldComponentUpdate (nextProps: Props, nextState: State) {
    return !shallowEqual(this.state, nextState) || !shallowEqual(this.props, nextProps)
  }

  componentWillReceiveProps (nextProps: Props) {
    const url = this.props.url || this.props.username
    const nextUrl = nextProps.url || nextProps.username

    if (url !== nextUrl) {
      const urlState = this._getURLState(nextProps)
      const nextState = {
        ...this._getLoadedErrorState(urlState.url),
        ...urlState,
      }

      this.setState(nextState)
      // if it's errored out we won't even try and load it so make sure we call teh onAvatarLoaded callback
      if (this.props.onAvatarLoaded && nextState.errored) {
        this.props.onAvatarLoaded()
      }
    }
  }

  _imgOnError = () => {
    if (this.state.url) {
      _avatarCache[this.state.url] = false
    }

    this.setState({errored: true})
    this.props.onAvatarLoaded && this.props.onAvatarLoaded()
  }

  _imgOnLoad = () => {
    if (this.state.url) {
      _avatarCache[this.state.url] = true
    }

    this.setState({avatarLoaded: true})
    this.props.onAvatarLoaded && this.props.onAvatarLoaded()
  }

  render () {
    const {size} = this.props
    const width = size
    const height = size
    const resolvedURL = this.state.url || noAvatar
    const avatarStyle = {width, height, position: 'absolute'}
    const borderStyle = this.props.borderColor ? {borderRadius: '50%', borderWidth: 2, borderStyle: 'solid', borderColor: this.props.borderColor} : {borderRadius: '50%'}

    const showLoadingColor = (this.props.loadingColor && !this.state.avatarLoaded) || this.props.forceLoading
    const alreadyGood = _avatarCache.hasOwnProperty(resolvedURL) && _avatarCache[resolvedURL]
    const alreadyBad = _avatarCache.hasOwnProperty(resolvedURL) && !_avatarCache[resolvedURL]
    const showNoAvatar = alreadyBad || (!showLoadingColor && ((!alreadyGood && !this.state.avatarLoaded) || this.state.errored))

    return (
      <div onClick={this.props.onClick} style={{...globalStyles.noSelect, position: 'relative', width, height, ...this.props.style}}>
        {this.props.backgroundColor &&
          <div
            style={{...avatarStyle,
              borderRadius: '50%',
              backgroundColor: this.props.backgroundColor,
              backgroundSize: 'cover',
            }} />}
        {showNoAvatar &&
          <img src={noAvatar} style={{...avatarStyle, ...borderStyle, display: 'block'}} />}
        {showLoadingColor && <div style={{...avatarStyle, ...borderStyle, backgroundColor: this.props.loadingColor}} />}
        {!alreadyBad &&
        <img
          src={resolvedURL}
          style={{
            ...avatarStyle,
            ...borderStyle,
            display: (!showNoAvatar && !showLoadingColor) ? 'block' : 'none',
            backgroundColor: this.props.backgroundColor || globalColors.white,
            opacity: this.props.hasOwnProperty('opacity') ? this.props.opacity : 1.0,
            backgroundClip: 'padding-box',
          }}
          onError={this._imgOnError}
          onLoad={this._imgOnLoad} />
        }
        <div>
          {size > 16 && (this.props.following || this.props.followsYou) &&
            <div>
              {this.props.followsYou && <div style={{...followTop(size, globalColors.green)}}> <div style={{...followInner(size, globalColors.white)}} /></div>}
              <div style={{...followBottom(size, this.props.following ? globalColors.green : globalColors.grey)}} />
            </div>
          }
          {this.props.children}
        </div>
      </div>
    )
  }
}

const followBadgeCommon = (size, color) => ({
  position: 'absolute',
  width: Math.round(size / 60 * 12),
  height: Math.round(size / 60 * 12),
  background: color,
  borderRadius: '50%',
  border: `${Math.round(size / 60 * 2)}px solid ${globalColors.white}`,
})

const followTop = (size, color) => ({
  ...followBadgeCommon(size, color),
  bottom: Math.round(size / 60 * 5),
  right: 0,
})

const followBottom = (size, color) => ({
  ...followBadgeCommon(size, color),
  bottom: 0,
  right: Math.round(size / 60 * 5),
})

const followInner = (size, color) => {
  const padding = Math.round(size / 60 * 12 / 7)
  return {
    position: 'absolute',
    background: color,
    borderRadius: size / 2,
    top: padding,
    right: padding,
    bottom: padding,
    left: padding,
  }
}

const initLookup = (lookup: AvatarLookup) => {
  _urlLookup = lookup
}

const initLoad = (load: AvatarLoad) => {
  _urlLoad = load
}

export default Avatar
export {
  initLookup,
  initLoad,
}
