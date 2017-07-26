// @flow
// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as I from 'immutable'
import React, {Component} from 'react'
import Render from './avatar.render'
import pickBy from 'lodash/pickBy'
import {iconTypeToImgSet, urlsToImgSet} from './icon'
import {isTesting} from '../local-debug'
import shallowEqual from 'shallowequal'
import {requestIdleCallback} from '../util/idle-callback'

import type {Props, AvatarLookup, AvatarLoad, URLMap, URLType} from './avatar'
import type {IconType} from './icon'

type State = {
  url: URLType,
}

const placeHolders: {[key: string]: IconType} = {
  '112': 'icon-placeholder-avatar-112',
  '12': 'icon-placeholder-avatar-24',
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
    theyNo: {youYes: 'icon-following-28'},
    theyYes: {youNo: 'icon-follow-me-28', youYes: 'icon-mutual-follow-28'},
  },
  '176': {
    theyNo: {youYes: 'icon-following-32'},
    theyYes: {youNo: 'icon-follow-me-32', youYes: 'icon-mutual-follow-32'},
  },
  '48': {
    theyNo: {youYes: 'icon-following-21'},
    theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'},
  },
  '64': {
    theyNo: {youYes: 'icon-following-21'},
    theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'},
  },
  '80': {
    theyNo: {youYes: 'icon-following-21'},
    theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'},
  },
})

const followStateToSize = I.fromJS({
  '112': {
    theyNo: {youYes: 28},
    theyYes: {youNo: 28, youYes: 28},
  },
  '176': {
    theyNo: {youYes: 32},
    theyYes: {youNo: 32, youYes: 32},
  },
  '48': {
    theyNo: {youYes: 21},
    theyYes: {youNo: 21, youYes: 21},
  },
  '64': {
    theyNo: {youYes: 21},
    theyYes: {youNo: 21, youYes: 21},
  },
  '80': {
    theyNo: {youYes: 21},
    theyYes: {youNo: 21, youYes: 21},
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
  _mounted: boolean = false
  _onURLLoaded = (username: string, urlMap: ?URLMap) => {
    // Mounted and still looking at the same username?
    requestIdleCallback(
      () => {
        if (this._mounted && this.props.username === username) {
          this.setState({url: this._urlMapsToUrl(urlMap)})
        }
      },
      {timeout: 300}
    )
  }

  constructor(props: Props) {
    super(props)
    if (props.url && props.username) {
      console.warn('Recieved both url and username to avatar!')
    }

    this.state = this._getRawURLState(props.url, props.size)
  }

  _getRawURLState(url: ?string, size: number): {url: any} {
    if (url) {
      return {url: urlsToImgSet({[String(size)]: url}, size)}
    } else {
      return {url: null}
    }
  }

  componentWillMount() {
    if (this.props.url) {
      this.setState(this._getRawURLState(this.props.url, this.props.size))
      // Just let it load the url, prefer this over username
    } else if (this.props.username) {
      this._loadUsername(this.props.username)
    } else {
      // Just show the no avatar state
      this.setState({url: this._noAvatar()})
    }
  }

  componentDidMount() {
    this._mounted = true
  }

  componentWillUnmount() {
    this._mounted = false
  }

  _noAvatar() {
    return iconTypeToImgSet(placeHolders[String(this.props.size)], this.props.size)
  }

  _urlMapsToUrl(urlMap: ?URLMap) {
    if (!urlMap || !Object.keys(urlMap).length) {
      return this._noAvatar()
    }

    return urlsToImgSet(pickBy(urlMap, value => value), this.props.size)
  }

  _loadUsername(username: string) {
    const urlMap = _avatarToURL ? _avatarToURL(username) : null
    const url = this._urlMapsToUrl(urlMap)
    this.setState({url})

    if (!urlMap && _loadAvatarToURL) {
      // Have to load it
      _loadAvatarToURL(username, (username: string, urlMap: ?URLMap) => {
        this._onURLLoaded(username, urlMap)
      })
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.url && nextProps.username) {
      console.warn('Recieved both url and username to avatar!')
      return
    }
    const url = this.props.url || this.props.username
    const nextUrl = nextProps.url || nextProps.username

    if (url !== nextUrl) {
      // Just show the url
      if (nextProps.url) {
        this.setState(this._getRawURLState(nextProps.url, nextProps.size))
      } else if (nextProps.username) {
        // We need to convert a username to a url
        this._loadUsername(nextProps.username)
      } else {
        this.setState({url: this._noAvatar()})
      }
    }
  }

  _followIconType() {
    return followStateToType.getIn([
      String(this.props.size),
      `they${this.props.followsYou ? 'Yes' : 'No'}`,
      `you${this.props.following ? 'Yes' : 'No'}`,
    ])
  }

  _followIconSize() {
    return followStateToSize.getIn([
      String(this.props.size),
      `they${this.props.followsYou ? 'Yes' : 'No'}`,
      `you${this.props.following ? 'Yes' : 'No'}`,
    ])
  }

  shouldComponentUpdate(nextProps: Props, nextState: any): boolean {
    return (
      this.state.url !== nextState.url ||
      !shallowEqual(this.props, nextProps, (obj, oth, key) => {
        if (key === 'style') {
          return shallowEqual(obj, oth)
        }
        return undefined
      })
    )
  }

  render() {
    const url = __SCREENSHOT__ || isTesting ? this._noAvatar() : this.state.url

    return (
      <Render
        borderColor={this.props.borderColor}
        children={this.props.children}
        followIconType={this._followIconType()}
        followIconSize={this._followIconSize()}
        followIconStyle={followSizeToStyle[this.props.size]}
        loadingColor={this.props.loadingColor}
        onClick={this.props.onClick}
        opacity={this.props.opacity}
        size={this.props.size}
        style={this.props.style}
        url={url}
      />
    )
  }
}

// To convert usernames/uids to avatarurls. This is setup on app start
let _avatarToURL
let _loadAvatarToURL

const initLookup = (lookup: AvatarLookup) => {
  _avatarToURL = lookup
}

const initLoad = (load: AvatarLoad) => {
  _loadAvatarToURL = load
}

export default Avatar
export {initLoad, initLookup}
