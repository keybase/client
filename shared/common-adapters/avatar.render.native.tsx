import Icon from './icon'
import * as React from 'react'
import * as Styles from '../styles'
import ClickableBox from './clickable-box'
import Box from './box'
import {NativeImage} from './native-image.native'
import {Props} from './avatar.render'

const Kb = {
  Box,
  ClickableBox,
  Icon,
  NativeImage,
}

type State = {
  loaded: boolean
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

const background = props => (
  <Kb.Box
    loadingColor={props.loadingColor}
    borderRadius={props.borderRadius}
    style={[
      styles.background,
      {
        backgroundColor: props.loaded
          ? Styles.globalColors.white
          : props.loadingColor || Styles.globalColors.greyLight,
        borderRadius: props.borderRadius,
      },
    ]}
  />
)

const userImage = ({onLoadEnd, url, size, borderRadius, opacity = 1}) => (
  <Kb.NativeImage
    source={url}
    onLoadEnd={onLoadEnd}
    style={[styles[`image:${size}`], {borderRadius, opacity}]}
  />
)

const borderOffset = -1
const borderSize = 1
// Layer on top to extend outside of the image
const border = ({borderColor, borderRadius}) => (
  <Kb.Box style={[styles.borderBase, {borderColor, borderRadius}]} />
)

class AvatarRender extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {loaded: !!this.props.load}
  }

  _mounted = false

  _onLoadOrError = () => {
    if (this._mounted && !this.state.loaded) {
      this.setState({loaded: true})
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.load && this.props.name !== prevProps.name) {
      this.props.load()
    }
    if (this.props.url !== prevProps.url) {
      this.setState({loaded: false})
    }
  }

  componentDidMount() {
    this._mounted = true
    this.props.load && this.props.load()
  }

  componentWillUnmount() {
    this._mounted = false
  }

  render() {
    const {size} = this.props
    const borderRadius = this.props.isTeam ? sizeToTeamBorderRadius[String(size)] : size / 2
    const containerStyle = Styles.collapseStyles([styles[`box:${size}`], this.props.style])

    return (
      <Kb.ClickableBox onClick={this.props.onClick} feedback={false} style={containerStyle}>
        <Kb.Box style={containerStyle}>
          {!this.props.skipBackground &&
            (!this.props.skipBackgroundAfterLoaded || !this.state.loaded) &&
            background({
              borderRadius: borderRadius,
              loaded: this.state.loaded,
              loadingColor: this.props.loadingColor,
            })}
          {!!this.props.url &&
            userImage({
              borderRadius: borderRadius,
              onLoadEnd: this._onLoadOrError,
              opacity: this.props.opacity,
              size: size,
              url: this.props.url,
            })}
          {(!!this.props.borderColor || this.props.isTeam) &&
            border({
              borderColor: this.props.borderColor || Styles.globalColors.black_10,
              borderRadius: borderRadius,
            })}
          {this.props.followIconType && (
            <Kb.Icon
              type={this.props.followIconType}
              style={Styles.collapseStyles([
                styles[`icon:${this.props.followIconSize}`],
                this.props.followIconStyle,
              ])}
            />
          )}
          {this.props.editable && (
            <Kb.Icon
              type="iconfont-edit"
              onClick={this.props.onEditAvatarClick}
              style={{
                bottom: this.props.isTeam ? -2 : 0,
                position: 'absolute',
                right: this.props.isTeam ? -28 : 0,
              }}
            />
          )}
          {this.props.children}
        </Kb.Box>
      </Kb.ClickableBox>
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
    backgroundColor: Styles.globalColors.fastBlank,
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

const styles = Styles.styleSheetCreate({
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
