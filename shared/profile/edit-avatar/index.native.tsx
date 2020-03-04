import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  padding,
  styleSheetCreate,
  platformStyles,
} from '../../styles'
import {isIOS, isTablet} from '../../constants/platform'
import {Props} from '.'
import {parseUri} from '../../util/expo-image-picker'

const {width: screenWidth} = Kb.NativeDimensions.get('window')

const avatar_size = (): number => {
  const big = screenWidth - globalMargins.medium * 2
  if (isTablet) {
    return Math.min(500, big)
  } else {
    return big
  }
}

class AvatarUpload extends React.Component<Props> {
  _h: number = 0
  _w: number = 0
  _x: number = 0
  _y: number = 0
  _z: boolean = false

  _onSave = () => {
    if (!this.props.image || this.props.image.cancelled === true) {
      throw new Error('Missing image when saving avatar')
    }
    let crop
    // Only set the cropping coordinates if they’ve zoomed the image.
    if (this._z) {
      crop = this._getCropCoordinates()
    }
    this.props.onSave(parseUri(this.props.image), crop)
  }

  _getCropCoordinates = () => {
    let height: number | null = null
    let width: number | null = null
    if (this.props.image && this.props.image.cancelled === false) {
      height = this.props.image.height
      width = this.props.image.width
    }

    const x = this._x
    const y = this._y
    const rH = this._h !== 0 && height ? height / this._h : 1
    const rW = this._w !== 0 && width ? width / this._w : 1
    const x0 = rW * x
    const y0 = rH * y
    return {
      x0: Math.round(x0),
      x1: Math.round((x + avatar_size()) * rW),
      y0: Math.round(y0),
      y1: Math.round((y + avatar_size()) * rH),
    }
  }

  _onZoom = ({height, width, x, y}: {height: number; width: number; x: number; y: number}) => {
    this._h = height
    this._w = width
    this._x = x
    this._y = y
    this._z = true
  }

  _imageDimensions = () => {
    if (!this.props.image || this.props.image.cancelled === true) return

    const AVATAR_SIZE = avatar_size()
    let height = AVATAR_SIZE
    let width = (AVATAR_SIZE * this.props.image.width) / this.props.image.height

    if (width < AVATAR_SIZE) {
      height = (AVATAR_SIZE * this.props.image.height) / this.props.image.width
      width = AVATAR_SIZE
    }

    return {
      height,
      width,
    }
  }

  render() {
    const uri =
      this.props.image && this.props.image.cancelled === false ? parseUri(this.props.image, true) : null
    return (
      <Kb.StandardScreen
        onCancel={this.props.onClose}
        scrollEnabled={false}
        style={styles.standardScreen}
        title={isIOS ? 'Zoom and pan' : 'Upload avatar'}
      >
        {!!this.props.error && <Kb.Banner color="red">{this.props.error}</Kb.Banner>}
        <Kb.Box style={styles.container}>
          <Kb.Box
            style={
              isIOS
                ? null
                : collapseStyles([
                    styles.zoomContainer,
                    {
                      borderRadius: this.props.teamname ? 32 : avatar_size(),
                      height: avatar_size(),
                      width: avatar_size(),
                    },
                  ])
            }
          >
            <Kb.ZoomableBox
              bounces={false}
              contentContainerStyle={this._imageDimensions()}
              maxZoom={10}
              onZoom={this._onZoom}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={
                isIOS
                  ? collapseStyles([
                      styles.zoomContainer,
                      {
                        borderRadius: this.props.teamname ? 32 : avatar_size(),
                        height: avatar_size(),
                        width: avatar_size(),
                      },
                    ])
                  : null
              }
            >
              {uri && (
                <Kb.NativeFastImage resizeMode="cover" source={{uri}} style={this._imageDimensions()} />
              )}
            </Kb.ZoomableBox>
          </Kb.Box>
          <Kb.ButtonBar direction="column">
            <Kb.WaitingButton
              fullWidth={true}
              label="Save"
              onClick={this._onSave}
              style={styles.button}
              waitingKey={this.props.waitingKey}
            />
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.StandardScreen>
    )
  }
}

const styles = styleSheetCreate(
  () =>
    ({
      button: {
        marginTop: globalMargins.tiny,
        width: '100%',
      },
      container: {
        ...padding(0, globalMargins.medium),
        marginBottom: globalMargins.small,
        marginTop: globalMargins.small,
      },
      standardScreen: {...padding(0)},
      zoomContainer: platformStyles({
        common: {
          backgroundColor: globalColors.grey,
          marginBottom: globalMargins.tiny,
          overflow: 'hidden',
          position: 'relative',
        },
        isTablet: {alignSelf: 'center'},
      }),
    } as const)
)

export default AvatarUpload
