// @flow
import Icon from './icon'
import React, {PureComponent} from 'react'
import {globalStyles, globalColors} from '../styles'

import type {AvatarSize} from './avatar'
import type {IconType} from './icon'

type ImageProps = {
  fallback: string,
  onError: () => void,
  onLoad: () => void,
  opacity: ?number,
  size: AvatarSize,
  url: string,
}

type Props = {
  borderColor: ?string,
  children: any,
  fallback: string,
  followIconStyle: ?Object,
  followIconType: ?IconType,
  loadingColor: ?string,
  onClick?: ?(() => void),
  opacity: ?number,
  size: AvatarSize,
  style?: ?Object,
  url: ?string,
}

type State = {
  loaded: boolean,
}

const backgroundOffset = 1
const Background = ({loaded, loadingColor}) => (
  <div
    style={{
      backgroundColor: loaded ? globalColors.white : loadingColor || globalColors.lightGrey,
      borderRadius: '50%',
      bottom: backgroundOffset,
      left: backgroundOffset,
      position: 'absolute',
      right: backgroundOffset,
      top: backgroundOffset,
    }} />
)

type ImageState ={
  errored: boolean,
}

class Image extends PureComponent<void, ImageProps, ImageState> {
  state: ImageState = {
    errored: false,
  }

  _onError = () => {
    this.props.onError()
    this.setState({errored: true})
  }

  render () {
    const {url, size, onLoad, fallback, opacity = 1} = this.props
    return (
      <img
        srcSet={this.state.errored ? fallback : url}
        sizes={`${size}px`}
        onLoad={onLoad}
        onError={this._onError}
        style={{
          borderRadius: '50%',
          bottom: 0,
          height: size,
          left: 0,
          opacity,
          position: 'absolute',
          right: 0,
          top: 0,
          width: size,
        }}
      />
    )
  }
}

const borderOffset = 1
const borderSize = 2
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
    }}
  />
)

class AvatarRender extends PureComponent<void, Props, State> {
  state: State = {
    loaded: false,
  }

  _mounted: boolean = false

  _onLoadOrError = (event) => {
    if (this._mounted) {
      this.setState({loaded: true})
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.url !== nextProps.url) {
      this.setState({loaded: false})
    }
  }

  componentDidMount () {
    this._mounted = true
  }

  componentWillUnmount () {
    this._mounted = false
  }

  render () {
    const {url, onClick, style, size, loadingColor, borderColor, opacity, followIconType, followIconStyle, children, fallback} = this.props

    return (
      <div
        onClick={onClick}
        style={{
          ...globalStyles.noSelect,
          height: size,
          position: 'relative',
          width: size,
          ...style,
        }}>
        <Background loaded={this.state.loaded} loadingColor={loadingColor} />
        {url && <Image
          fallback={fallback}
          onError={this._onLoadOrError}
          onLoad={this._onLoadOrError}
          opacity={opacity}
          size={size}
          url={url}
        /> }
        {!!borderColor && <Border borderColor={borderColor} />}
        {followIconType && <Icon type={followIconType} style={followIconStyle} />}
        {children}
      </div>
    )
  }
}

export default AvatarRender
