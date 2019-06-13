import * as React from 'react'
import {Banner, Box, ButtonBar, StandardScreen, WaitingButton} from '../../common-adapters'
import {NativeDimensions, NativeFastImage, ZoomableBox} from '../../common-adapters/mobile.native'
import {collapseStyles, globalColors, globalMargins, padding, styleSheetCreate} from '../../styles'
import {isIOS} from '../../constants/platform'
import {Props} from '.'

const {width: screenWidth} = NativeDimensions.get('window')
const AVATAR_SIZE = screenWidth - globalMargins.medium * 2

class AvatarUpload extends React.Component<Props> {
  _h: number = 0
  _w: number = 0
  _x: number = 0
  _y: number = 0
  _z: boolean = false

  _onSave = () => {
    if (!this.props.image) {
      throw new Error('Missing image when saving avatar')
    }
    const filename = isIOS ? this.props.image.uri.replace('file://', '') : this.props.image.path
    let crop
    // Only set the cropping coordinates if they’ve zoomed the image.
    if (this._z) {
      crop = this._getCropCoordinates()
    }
    this.props.onSave(filename, crop)
  }

  _getCropCoordinates = () => {
    const x = this._x
    const y = this._y
    const rH = this._h !== 0 && this.props.image ? this.props.image.height / this._h : 1
    const rW = this._w !== 0 && this.props.image ? this.props.image.width / this._w : 1
    const x0 = rW * x
    const y0 = rH * y
    return {
      x0: Math.round(x0),
      x1: Math.round((x + AVATAR_SIZE) * rW),
      y0: Math.round(y0),
      y1: Math.round((y + AVATAR_SIZE) * rH),
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
    if (!this.props.image) return

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
    return (
      <StandardScreen
        onCancel={this.props.onClose}
        scrollEnabled={false}
        style={styles.standardScreen}
        title={isIOS ? 'Zoom and pan' : 'Upload avatar'}
      >
        {!!this.props.error && <Banner text={this.props.error} color="red" />}
        <Box style={styles.container}>
          <Box
            style={
              isIOS
                ? null
                : collapseStyles([
                    styles.zoomContainer,
                    {
                      borderRadius: this.props.teamname ? 32 : AVATAR_SIZE,
                    },
                  ])
            }
          >
            <ZoomableBox
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
                        borderRadius: this.props.teamname ? 32 : AVATAR_SIZE,
                      },
                    ])
                  : null
              }
            >
              <NativeFastImage
                resizeMode="cover"
                source={{uri: `${this.props.image ? this.props.image.uri : ''}`}}
                style={this._imageDimensions()}
              />
            </ZoomableBox>
          </Box>
          <ButtonBar direction="column">
            <WaitingButton
              fullWidth={true}
              label="Save"
              onClick={this._onSave}
              style={styles.button}
              waitingKey={this.props.waitingKey}
            />
          </ButtonBar>
        </Box>
      </StandardScreen>
    )
  }
}

const styles = styleSheetCreate({
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
  zoomContainer: {
    backgroundColor: globalColors.grey,
    height: AVATAR_SIZE,
    marginBottom: globalMargins.tiny,
    overflow: 'hidden',
    position: 'relative',
    width: AVATAR_SIZE,
  },
} as const)

export default AvatarUpload
