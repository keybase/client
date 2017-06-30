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
  loadingColor: ?string,
  onClick?: ?() => void,
  opacity: ?number,
  size: AvatarSize,
  style?: ?Object,
  url: ?string,
}

type State = {
  loaded: boolean,
}

// The background is a separate layer due to a chrome bug where if you keep it as a background of an img (for example) it'll bleed the edges
const backgroundOffset = 1
class Background extends PureComponent<void, {loaded: boolean, loadingColor: ?string}, void> {
  render() {
    const Div = glamorous.div(
      {
        borderRadius: '50%',
        bottom: backgroundOffset,
        left: backgroundOffset,
        position: 'absolute',
        right: backgroundOffset,
        top: backgroundOffset,
      },
      props => ({
        backgroundColor: props.loaded ? globalColors.white : props.loadingColor || globalColors.lightGrey,
      })
    )
    return <Div loaded={this.props.loaded} loadingColor={this.props.loadingColor} />
  }
}

// The actual image
class UserImage extends PureComponent<void, ImageProps, void> {
  render() {
    const Div = glamorous.div(
      {
        backgroundSize: 'cover',
        borderRadius: '50%',
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
          height: props.size,
          maxWidth: props.size,
          minWidth: props.size,
          opacity,
        }
      }
    )

    return <Div opacity={this.props.opacity} size={this.props.size} url={this.props.url} />
  }
}

const borderOffset = 1
const borderSize = 2
// Layer on top to extend outside of the image
const Border = ({borderColor, size}) => (
  <div
    style={{
      background: globalColors.transparent,
      borderRadius: '100%',
      bottom: borderOffset,
      boxShadow: `0px 0px 0px ${borderSize}px ${borderColor}`,
      left: borderOffset,
      position: 'absolute',
      right: borderOffset,
      top: borderOffset,
      minWidth: size,
      maxWidth: size,
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
    const {
      url,
      onClick,
      style,
      size,
      loadingColor,
      borderColor,
      opacity,
      followIconType,
      followIconStyle,
      children,
    } = this.props

    return (
      <div
        onClick={onClick}
        style={{
          ...globalStyles.noSelect,
          height: size,
          position: 'relative',
          minWidth: size,
          maxWidth: size,
          ...style,
        }}
      >
        <Background loaded={this.state.loaded} loadingColor={loadingColor} />
        {url && <UserImage opacity={opacity} size={size} url={url} />}
        {!!borderColor && <Border borderColor={borderColor} size={size} />}
        {followIconType && <Icon type={followIconType} style={followIconStyle} />}
        {children}
      </div>
    )
  }
}

export default AvatarRender
