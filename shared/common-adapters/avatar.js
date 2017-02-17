// @flow
// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as I from 'immutable'
import React, {Component} from 'react'
import Render from './avatar.render.desktop'
import {isTesting} from '../local-debug'

import type {Props, AvatarLookup, AvatarLoad} from './avatar'

type State = {
  url: ?string,
}

const NO_AVATAR = 'NO_AVATAR'

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
  state: State = {
    url: null,
  }

  _onURLLoaded: ?(username: string, url: ?string) => void;

  constructor (props: Props) {
    super(props)
    if (props.url && props.username) {
      console.warn('Recieved both url and username to avatar!')
    }
  }

  componentWillMount () {
    if (this.props.url) {
      this.setState({url: this.props.url})
      // Just let it load the url, prefer this over username
    } else if (this.props.username) {
      this._loadUsername(this.props.username)
    } else { // Just show the no avatar state
      this.setState({url: NO_AVATAR})
    }
  }

  componentDidMount () {
    this._onURLLoaded = (username: string, url: ?string) => {
      // Still looking at the same username?
      if (this.props.username === username) {
        this.setState({url: url || NO_AVATAR})
      }
    }
  }

  componentWillUnmount () {
    // Don't let the callback do anything if we've unmounted
    this._onURLLoaded = null
  }

  _loadUsername (username: string) {
    const url = _avatarToURL ? _avatarToURL(username) : null
    this.setState({url})

    if (!url) { // Have to load it
      _loadAvatarToURL(username, (username: string, url: ?string) => {
        this._onURLLoaded && this._onURLLoaded(username, url)
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
      return null
    }

    return <Render
      borderColor={this.props.borderColor}
      followIconType={this._followIconType()}
      followIconStyle={followSizeToStyle[this.props.size]}
      loadingColor={this.props.loadingColor}
      onClick={this.props.onClick}
      opacity={this.props.opacity}
      size={this.props.size}
      style={this.props.style}
      url={this.state.url}
    >{this.props.children}</Render>
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
  NO_AVATAR,
  initLoad,
  initLookup,
}
