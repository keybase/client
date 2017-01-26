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

  _onLoadDone = (avatarCache: AvatarCache) => {
    const triedToLoad = avatarCache.hasOwnProperty(this.state.url)
    const loadSuccess = avatarCache[this.state.url || '']
    this.setState({resolvedURL: triedToLoad && loadSuccess && this.state.url})
  }

  render () {
    const {size} = this.props
    const width = size
    const height = size
    // const resolvedURL = this.state.url || noAvatar
    const avatarStyle = {width, height, position: 'absolute'}
    const borderStyle = this.props.borderColor ? {borderRadius: '50%', borderWidth: 2, borderStyle: 'solid', borderColor: this.props.borderColor} : {borderRadius: '50%'}

    const showLoadingColor = (this.props.loadingColor && !this.state.avatarLoaded) || this.props.forceLoading
    // const alreadyGood = _avatarCache.hasOwnProperty(resolvedURL) && _avatarCache[resolvedURL]
    // const alreadyBad = _avatarCache.hasOwnProperty(resolvedURL) && !_avatarCache[resolvedURL]
    const showNoAvatar = alreadyBad || (!showLoadingColor && ((!alreadyGood && !this.state.avatarLoaded) || this.state.errored))

    const containerStyle = {
      ...globalStyles.noSelect,
      height,
      position: 'relative',
      width,
      ...this.props.style,
    }

    const image = this.state.resolvedURL && (
      <img
        src={this.state.resolvedURL}
        style={{
          ...avatarStyle,
          ...borderStyle,
          backgroundColor: this.props.backgroundColor || globalColors.white,
          display: (!showNoAvatar && !showLoadingColor) ? 'block' : 'none',
          opacity: this.props.hasOwnProperty('opacity') ? this.props.opacity : 1.0,
        }} />
    )

      // TODO
        // {showNoAvatar &&
          // <img src={noAvatar} style={{...avatarStyle, ...borderStyle, display: 'block'}} />}
        // {showLoadingColor && <div style={{...avatarStyle, ...borderStyle, backgroundColor: this.props.loadingColor}} />}

    return (
      <div onClick={this.props.onClick} style={containerStyle}>
        <ImageLoader url={this.state.url} onLoadDone={this._onLoadDone} />
        {image}
        <div>
          {size > 16 && (this.props.following || this.props.followsYou) && <FollowDots followsYou={this.props.followsYou} following={this.props.following} size={this.props.size} />}
          {this.props.children}
        </div>
      </div>
    )
  }
}

// Holds the loaded or errored state. undefined if we don't know. So we can skip trying this on repeat images
type AvatarCache = {[key: string]: ?boolean}
const _avatarCache: AvatarCache = { }

type LoaderProps = {
  url: ?string,
  onLoadDone: (avatarCache: AvatarCache) => void,
}

// Loads an image and tells you if the image is good or not, doens't render anything visibly!
class ImageLoader extends Component<void, LoaderProps, void> {
  componentWillReceiveProps (nextProps: Props) {
    if (_avatarCache.hasOwnProperty(nextProps.url)) {
      nextProps.onLoadDone(_avatarCache)
    }
  }

  _imgOnError = () => {
    if (this.props.url) {
      _avatarCache[this.props.url] = false
    }
    this.props.onLoadDone(_avatarCache)
  }

  _imgOnLoad = () => {
    if (this.props.url) {
      _avatarCache[this.props.url] = true
    }
    this.props.onLoadDone(_avatarCache)
  }

  render () {
    return <img
      src={this.props.url}
      style={{maxWidth: 0, maxHeight: 0}}
      onError={this._imgOnError}
      onLoad={this._imgOnLoad} />
  }
}

const FollowDots = ({followsYou, following, size}) => (
  <div>
    {followsYou && (
    <div style={{...followTop(size, globalColors.green)}}>
      <div style={{...followInner(size, globalColors.white)}} />
    </div>)
    }
    <div style={{...followBottom(size, following ? globalColors.green : globalColors.grey)}} />
  </div>
)

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
