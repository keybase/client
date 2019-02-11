// @flow
import Icon from './icon'
import * as React from 'react'
import {globalColors, styleSheetCreate, collapseStyles} from '../styles'
import ClickableBox from './clickable-box'
import Box from './box'
import {NativeImage} from './native-image.native'
import type {AvatarSize, Props} from './avatar.render'

type ImageProps = {
  onLoadEnd: () => void,
  opacity: ?number,
  size: AvatarSize,
  url: string,
  borderRadius: any,
}

type State = {
  loaded: boolean,
}

const sizeToTeamBorderRadius = {
  '12': 2,
  '128': 12,
  '16': 4,
  '32': 5,
  '48': 6,
  '64': 8,
  '96': 10,
}

// Android doesn't handle background colors border radius setting
const backgroundOffset = 1

class Background extends React.PureComponent<{loaded: boolean, loadingColor: any, borderRadius: number}> {
  render() {
    return (
      <Box
        loadingColor={this.props.loadingColor}
        borderRadius={this.props.borderRadius}
        style={[
          styles.background,
          {
            backgroundColor: this.props.loaded
              ? globalColors.white
              : this.props.loadingColor || globalColors.lightGrey,
            borderRadius: this.props.borderRadius,
          },
        ]}
      />
    )
  }
}

class UserImage extends React.PureComponent<ImageProps> {
  render() {
    const {borderRadius, opacity = 1} = this.props
    return (
      <NativeImage
        source={this.props.url}
        onLoadEnd={this.props.onLoadEnd}
        style={[styles[`image:${this.props.size}`], {borderRadius, opacity}]}
      />
    )
  }
}

const borderOffset = -1
const borderSize = 1
// Layer on top to extend outside of the image
class Border extends React.PureComponent<{borderColor: any, borderRadius: number}> {
  render() {
    return (
      <Box
        style={[
          styles.borderBase,
          {
            borderColor: this.props.borderColor,
            borderRadius: this.props.borderRadius,
          },
        ]}
      />
    )
  }
}

class AvatarRender extends React.PureComponent<Props, State> {
  state: State = {loaded: false}

  _mounted: boolean = false

  _onLoadOrError = () => {
    if (this._mounted) {
      this.setState({loaded: true})
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.url !== prevProps.url) {
      this.setState({loaded: false})
    }
  }

  componentDidMount() {
    this._mounted = true
  }

  componentWillUnmount() {
    this._mounted = false
  }

  render() {
    const {size} = this.props
    const borderRadius = this.props.isTeam ? sizeToTeamBorderRadius[String(size)] : size / 2
    const containerStyle = collapseStyles([styles[`box:${size}`], this.props.style])

    return (
      <ClickableBox onClick={this.props.onClick} feedback={false} style={containerStyle}>
        <Box style={containerStyle}>
          {!this.props.skipBackground && (!this.props.skipBackgroundAfterLoaded || !this.state.loaded) && (
            <Background
              loaded={this.state.loaded}
              loadingColor={this.props.loadingColor}
              borderRadius={borderRadius}
            />
          )}
          {!!this.props.url && (
            <UserImage
              opacity={this.props.opacity}
              onLoadEnd={this._onLoadOrError}
              size={size}
              url={this.props.url}
              borderRadius={borderRadius}
            />
          )}
          {(!!this.props.borderColor || this.props.isTeam) && (
            <Border
              borderColor={this.props.borderColor || globalColors.black_10}
              borderRadius={borderRadius}
            />
          )}
          {this.props.followIconType && (
            <Icon
              type={this.props.followIconType}
              style={collapseStyles([
                styles[`icon:${this.props.followIconSize}`],
                this.props.followIconStyle,
              ])}
            />
          )}
          {this.props.editable && (
            <Icon
              type="iconfont-edit"
              onClick={this.props.onEditAvatarClick}
              style={{
                bottom: this.props.isTeam ? -2 : 0,
                position: 'absolute',
                right: this.props.isTeam ? -18 : 0,
              }}
            />
          )}
          {this.props.children}
        </Box>
      </ClickableBox>
    )
  }
}

const sizes = [128, 96, 64, 48, 32, 16, 12]

const iconStyles = sizes.reduce((map, size) => {
  map[`icon:${size}`] = {height: size, width: size}
  return map
}, {})

const boxStyles = sizes.reduce((map, size) => {
  map[`box:${size}`] = {height: size, position: 'relative', width: size}
  return map
}, {})

const imageStyles = sizes.reduce((map, size) => {
  map[`image:${size}`] = {
    backgroundColor: globalColors.fastBlank,
    bottom: 0,
    height: size,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: size,
  }
  return map
}, {})

const styles = styleSheetCreate({
  ...boxStyles,
  ...iconStyles,
  ...imageStyles,
  background: {
    bottom: backgroundOffset,
    left: backgroundOffset,
    position: 'absolute',
    right: backgroundOffset,
    top: backgroundOffset,
  },
  borderBase: {
    borderWidth: borderSize,
    bottom: borderOffset,
    left: borderOffset,
    margin: borderSize / 2,
    position: 'absolute',
    right: borderOffset,
    top: borderOffset,
  },
})

export default AvatarRender
