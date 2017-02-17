// @flow
// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as I from 'immutable'
import Box from './box'
import React, {Component} from 'react'
import Render from './avatar.render.desktop'
import {globalColors} from '../styles'
import {iconTypeToSrcSet, urlsToSrcSet} from './icon'
import {isTesting} from '../local-debug'

import type {Props, AvatarLookup, AvatarLoad, URLMap} from './avatar'
import type {IconType} from './icon'

type State = {
  url: ?string,
  fallback: string,
}

const placeHolders: {[key: string]: IconType} = {
  '112': 'icon-placeholder-avatar-112',
  '16': 'icon-placeholder-avatar-24',
  '176': 'icon-placeholder-avatar-176',
  '24': 'icon-placeholder-avatar-24',
  '32': 'icon-placeholder-avatar-32',
  '40': 'icon-placeholder-avatar-48',
  '48': 'icon-placeholder-avatar-48',
  '64': 'icon-placeholder-avatar-64',
  '80': 'icon-placeholder-avatar-80',
}

const followStateToType = I.fromJS({
  '112': {
    'theyNo': {'youYes': 'icon-following-28'},
    'theyYes': {'youNo': 'icon-follow-me-28', 'youYes': 'icon-mutual-follow-28'},
  },
  '176': {
    'theyNo': {'youYes': 'icon-following-32'},
    'theyYes': {'youNo': 'icon-follow-me-32', 'youYes': 'icon-mutual-follow-32'},
  },
  '48': {
    'theyNo': {'youYes': 'icon-following-21'},
    'theyYes': {'youNo': 'icon-follow-me-21', 'youYes': 'icon-mutual-follow-21'},
  },
  '64': {
    'theyNo': {'youYes': 'icon-following-21'},
    'theyYes': {'youNo': 'icon-follow-me-21', 'youYes': 'icon-mutual-follow-21'},
  },
  '80': {
    'theyNo': {'youYes': 'icon-following-21'},
    'theyYes': {'youNo': 'icon-follow-me-21', 'youYes': 'icon-mutual-follow-21'},
  },
})

const followSizeToStyle = {
  '112': {bottom: 0, left: 80, position: 'absolute'},
  '176': {bottom: 6, left: 132, position: 'absolute'},
  '48': {bottom: 0, left: 32, position: 'absolute'},
  '64': {bottom: 0, left: 45, position: 'absolute'},
  '80': {bottom: 0, left: 57, position: 'absolute'},
}

class Avatar extends Component<void, Props, State> {
  state: State
  _onURLLoaded: ?(username: string, urlMap: ?{[key: string]: string}) => void

  constructor (props: Props) {
    super(props)
    if (props.url && props.username) {
      console.warn('Recieved both url and username to avatar!')
    }

    this.state = {
      fallback: this._noAvatar(), // we assume sizes don't change dynamically so we basically never update this. True so far so keep it simple
      url: null,
    }
  }

  componentWillMount () {
    if (this.props.url) {
      this.setState({url: this.props.url})
      // Just let it load the url, prefer this over username
    } else if (this.props.username) {
      this._loadUsername(this.props.username)
    } else { // Just show the no avatar state
      this.setState({url: this._urlMapsToUrl(null)})
    }
  }

  componentDidMount () {
    this._onURLLoaded = (username: string, urlMap: ?URLMap) => {
      // Still looking at the same username?
      if (this.props.username === username) {
        this.setState({url: this._urlMapsToUrl(urlMap)})
      }
    }
  }

  componentWillUnmount () {
    // Don't let the callback do anything if we've unmounted
    this._onURLLoaded = null
  }

  _noAvatar () {
    return iconTypeToSrcSet(placeHolders[String(this.props.size)])
  }

  _urlMapsToUrl (urlMap: ?URLMap) {
    if (!urlMap) {
      return null
    }

    // always have a fallback for the sizes
    // const low = 'https://s3.amazonaws.com/keybase_processed_uploads/c6c7e3ba37b373ff0fa939a94fffde05_40_40_square_40.jpeg'
      // //urlMap['40'] || urlMap['200'] || urlMap['360']
    // const medium = urlMap['200'] || urlMap['360'] || urlMap['40']
    // const high = urlMap['360'] || urlMap['200'] || urlMap['40']

    // let imgs = []
    // switch (this.props.size) {
      // case 176:
      // case 112: // fallthrough
        // imgs = [medium, high]
        // break
      // case 80:
      // case 64: // fallthrough
      // case 48: // fallthrough
        // imgs = [medium, medium]
        // break
      // case 40:
      // case 32: // fallthrough
        // imgs = [low, medium]
        // break
      // case 24:
      // case 16: // fallthrough
        // imgs = [low, low]
        // break
    // }
    //
    const um: URLMap = urlMap
    const imgs = Object.keys(um).filter(size => um[size]).map(size => ({
      path: um[size],
      size,
    }))

    return urlsToSrcSet(imgs) || this._noAvatar()
  }

  _loadUsername (username: string) {
    const urlMap = _avatarToURL ? _avatarToURL(username) : null
    const url = this._urlMapsToUrl(urlMap)
    this.setState({url})

    if (!urlMap) { // Have to load it
      _loadAvatarToURL(username, (username: string, urlMap: ?URLMap) => {
        this._onURLLoaded && this._onURLLoaded(username, urlMap)
      })
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    if (nextProps.url && nextProps.username) {
      console.warn('Recieved both url and username to avatar!')
      return
    }
    const url = this.props.url || this.props.username
    const nextUrl = nextProps.url || nextProps.username

    if (url !== nextUrl) {
      // Just show the url
      if (nextProps.url) {
        this.setState({url: nextProps.url})
      } else if (nextProps.username) {  // We need to convert a username to a url
        this._loadUsername(nextProps.username)
      }
    }
  }

  _followIconType () {
    return followStateToType.getIn([String(this.props.size), `they${this.props.followsYou ? 'Yes' : 'No'}`, `you${this.props.following ? 'Yes' : 'No'}`])
  }

  render () {
    if (__SCREENSHOT__ || isTesting) {
      return <Box style={{
        backgroundColor: globalColors.orange,
        borderRadius: this.props.size / 2,
        height: this.props.size,
        width: this.props.size,
      }} />
    }

    return <Render
      borderColor={this.props.borderColor}
      children={this.props.children}
      fallback={this.state.fallback}
      followIconType={this._followIconType()}
      followIconStyle={followSizeToStyle[this.props.size]}
      loadingColor={this.props.loadingColor}
      onClick={this.props.onClick}
      opacity={this.props.opacity}
      size={this.props.size}
      style={this.props.style}
      url={this.state.url} />
  }
}

// To convert usernames/uids to avatarurls
let _avatarToURL
let _loadAvatarToURL

const initLookup = (lookup: AvatarLookup) => {
  // TODO get multiple for srcset
  _avatarToURL = lookup
}

const initLoad = (load: AvatarLoad) => {
  _loadAvatarToURL = load
}

export default Avatar
export {
  initLoad,
  initLookup,
}
