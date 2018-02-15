// @flow
import Icon from './icon'
import * as React from 'react'
import {globalColors, styleSheetCreate} from '../styles'
import ClickableBox from './clickable-box'
import Box from './box'
import {Image} from 'react-native'

import type {AvatarSize} from './avatar'
import type {IconType} from './icon'

type ImageProps = {
  onLoadEnd: () => void,
  opacity: ?number,
  size: AvatarSize,
  url: string,
  borderRadius: any,
}

type Props = {
  borderColor: ?string,
  children: any,
  followIconStyle: ?Object,
  followIconType: ?IconType,
  followIconSize: number,
  isTeam?: boolean,
  loadingColor: ?string,
  onClick?: ?(event: SyntheticEvent<>) => void,
  opacity: ?number,
  skipBackground?: boolean,
  skipBackgroundAfterLoaded?: boolean,
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

// Android doesn't handle background colors border radius setting
const backgroundOffset = 1

class Background extends React.PureComponent<{loaded: boolean, loadingColor: any, borderRadius: number}> {
  render() {
    return (
      <Box
        loaded={this.props.loaded}
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
      <Image
        source={this.props.url}
        onLoadEnd={this.props.onLoadEnd}
        style={[styles[`image:${this.props.size}`], {borderRadius, opacity}]}
      />
    )
  }
}

const borderOffset = -1
const borderSize = 2
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
  state: State = {
    loaded: false,
  }

  _mounted: boolean = false

  _onLoadOrError = () => {
    if (this._mounted) {
      this.setState({loaded: true})
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.url !== nextProps.url) {
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

    return (
      <ClickableBox onClick={this.props.onClick} feedback={false} style={styles[`box:${size}`]}>
        <Box style={styles[`box:${size}`]}>
          {!this.props.skipBackground &&
            (!this.props.skipBackgroundAfterLoaded || !this.state.loaded) && (
              <Background
                loaded={this.state.loaded}
                loadingColor={this.props.loadingColor}
                borderRadius={this.props.borderRadius}
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
          {!!this.props.borderColor && (
            <Border borderColor={this.props.borderColor} borderRadius={borderRadius} />
          )}
          {this.props.followIconType && (
            <Icon
              type={this.props.followIconType}
              style={[styles[`icon:${size}`], this.props.followIconStyle]}
            />
          )}
          {this.props.children}
        </Box>
      </ClickableBox>
    )
  }
}

const sizes = [176, 112, 80, 64, 48, 40, 32, 24, 16, 12]

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
