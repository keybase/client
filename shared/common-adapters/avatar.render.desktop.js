// @flow
import Icon from './icon'
import React, {PureComponent} from 'react'
import {globalStyles, globalColors} from '../styles'
import glamorous from 'glamorous'

import type {AvatarSize} from './avatar'
import type {IconType} from './icon'

type ImageProps = {
  opacity: ?number,
  size: AvatarSize,
  url: string,
}

type Props = {
  borderColor: ?string,
  children: any,
  followIconStyle: ?Object,
  followIconType: ?IconType,
  isTeam?: boolean,
  loadingColor: ?string,
  onClick?: ?() => void,
  opacity: ?number,
  skipBackground?: boolean,
  size: AvatarSize,
  style?: ?Object,
  url: ?string,
}

type State = {
  loaded: boolean,
}

const sizeToTeamBorderRadius = {
  '112': 12,
  '12': 3,
  '16': 4,
  '176': 24,
  '24': 4,
  '32': 5,
  '40': 6,
  '48': 6,
  '64': 8,
  '80': 10,
}

// The background is a separate layer due to a chrome bug where if you keep it as a background of an img (for example) it'll bleed the edges
const backgroundOffset = 1
const BackgroundDiv = glamorous.div(
  {
    bottom: backgroundOffset,
    left: backgroundOffset,
    position: 'absolute',
    right: backgroundOffset,
    top: backgroundOffset,
  },
  props => ({
    backgroundColor: props.loaded ? globalColors.white : props.loadingColor || globalColors.lightGrey,
    borderRadius: props.borderRadius,
  })
)
class Background
  extends PureComponent<void, {loaded: boolean, loadingColor: ?string, borderRadius: any}, void> {
  render() {
    return (
      <BackgroundDiv
        loaded={this.props.loaded}
        loadingColor={this.props.loadingColor}
        borderRadius={this.props.borderRadius}
      />
    )
  }
}

// The actual image
const UserImageDiv = glamorous.div(
  {
    backgroundSize: 'cover',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  props => {
    const {opacity = 1} = props
    return {
      backgroundImage: props.url,
      borderRadius: props.borderRadius,
      height: props.size,
      maxWidth: props.size,
      minWidth: props.size,
      opacity,
    }
  }
)
class UserImage extends PureComponent<void, ImageProps, void> {
  render() {
    return (
      <UserImageDiv
        opacity={this.props.opacity}
        size={this.props.size}
        url={this.props.url}
        borderRadius={this.props.borderRadius}
      />
    )
  }
}

const borderOffset = 1
const borderSize = 2
// Layer on top to extend outside of the image
const Border = ({borderColor, size, borderRadius}) => (
  <div
    style={{
      background: globalColors.transparent,
      borderRadius,
      bottom: borderOffset,
      boxShadow: `0px 0px 0px ${borderSize}px ${borderColor}`,
      left: borderOffset,
      maxWidth: size,
      minWidth: size,
      position: 'absolute',
      right: borderOffset,
      top: borderOffset,
    }}
  />
)

const _alreadyLoaded: {[name: string]: ?true} = {}

class AvatarRender extends PureComponent<void, Props, State> {
  state: State = {
    loaded: false,
  }

  _mounted: boolean = false
  _image: any

  _onLoadOrError = event => {
    if (this.props.url) {
      _alreadyLoaded[this.props.url] = true
    }
    if (this._mounted) {
      this.setState({loaded: true})
    }
    this._image = null
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.url !== nextProps.url) {
      if (nextProps.url && !_alreadyLoaded[nextProps.url]) {
        this.setState({loaded: false})
        this._internalLoad(nextProps.url)
      } else {
        this.setState({loaded: true})
      }
    }
  }

  _internalLoad(url: ?string) {
    if (url) {
      const match = url.match(/url\('([^']*)/)
      if (match) {
        const single = match[1]
        if (!this._image) {
          this._image = new Image() // eslint-disable-line
          this._image.onload = this._onLoadOrError
          this._image.onerror = this._onLoadOrError
          this._image.src = single
        } else {
          this._image.src = single
        }
      }
    }
  }

  componentWillMount() {
    if (this.props.url && _alreadyLoaded[this.props.url]) {
      this.setState({loaded: true})
    }
  }

  componentDidMount() {
    this._mounted = true

    if (this.props.url && !_alreadyLoaded[this.props.url]) {
      this._internalLoad(this.props.url)
    }
  }

  componentWillUnmount() {
    this._mounted = false
  }

  render() {
    const borderRadius = this.props.isTeam ? sizeToTeamBorderRadius[String(this.props.size)] : '50%'

    return (
      <div
        onClick={this.props.onClick}
        style={{
          ...globalStyles.noSelect,
          height: this.props.size,
          maxWidth: this.props.size,
          minWidth: this.props.size,
          position: 'relative',
          ...this.props.style,
        }}
      >
        {!this.props.skipBackground &&
          <Background
            loaded={this.state.loaded}
            loadingColor={this.props.loadingColor}
            borderRadius={borderRadius}
          />}
        {this.props.url &&
          <UserImage
            opacity={this.props.opacity}
            size={this.props.size}
            url={this.props.url}
            borderRadius={borderRadius}
          />}
        {!!this.props.borderColor &&
          <Border borderColor={this.props.borderColor} size={this.props.size} borderRadius={borderRadius} />}
        {this.props.followIconType &&
          <Icon type={this.props.followIconType} style={this.props.followIconStyle} />}
        {this.props.children}
      </div>
    )
  }
}

export default AvatarRender
