// @flow
import * as React from 'react'
import {Box, ButtonBar, StandardScreen, WaitingButton} from '../../common-adapters'
import {NativeDimensions, NativeImage, ZoomableBox} from '../../common-adapters/mobile.native'
import {globalColors, globalMargins, styleSheetCreate} from '../../styles'
import {isIOS} from '../../constants/platform'
import type {Props} from '.'

const {width: screenWidth} = NativeDimensions.get('window')
const AVATAR_SIZE = screenWidth - globalMargins.medium * 2

class EditAvatar extends React.Component<Props> {
  _h: number = 0
  _w: number = 0
  _x: number = 0
  _y: number = 0

  _onSave = () => {
    if (!this.props.image) {
      throw new Error('Missing image when saving avatar')
    }
    const filename = isIOS ? this.props.image.uri.replace('file://', '') : this.props.image.path
    // Cropping is temporarily deactivated on Android.
    if (isIOS) {
      this.props.onSave(filename, this._getCropCoordinates())
      return
    }
    this.props.onSave(filename)
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

  _onZoom = ({height, width, x, y}: {height: number, width: number, x: number, y: number}) => {
    this._h = height
    this._w = width
    this._x = x
    this._y = y
  }

  _imageDimensions = () => {
    if (!this.props.image) return

    // Cropping is temporarily deactivated on Android. So, we’re restricting
    // the image to the avatar bounds.
    let height = isIOS ? this.props.image.height : AVATAR_SIZE
    let width = isIOS ? this.props.image.width : AVATAR_SIZE

    if (height <= AVATAR_SIZE) {
      height = AVATAR_SIZE
      width = AVATAR_SIZE * this.props.image.width / this.props.image.height
    }

    if (width <= AVATAR_SIZE) {
      height = AVATAR_SIZE * this.props.image.height / this.props.image.width
      width = AVATAR_SIZE
    }

    return {
      height,
      // We need to center the image on Android because this is how the backend
      // will crop it when we don’t pass cropping coordinates.
      marginLeft: isIOS ? null : (width - AVATAR_SIZE) / -2,
      marginTop: isIOS ? null : (height - AVATAR_SIZE) / -2,
      width,
    }
  }

  render() {
    return (
      <StandardScreen
        onCancel={this.props.onClose}
        scrollEnabled={false}
        title={isIOS ? 'Zoom and pan' : 'Upload avatar'}
      >
        <Box style={styles.container}>
          <Box style={isIOS ? null : styles.zoomContainer}>
            <ZoomableBox
              bounces={false}
              contentContainerStyle={this._imageDimensions()}
              // Temporarily deactive zooming on Android.
              maxZoom={isIOS ? 10 : 1}
              onZoom={isIOS ? this._onZoom : null}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={styles.zoomContainer}
            >
              <NativeImage
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
              type="Primary"
              waitingKey={null}
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
    marginBottom: globalMargins.small,
    marginTop: globalMargins.small,
  },
  zoomContainer: {
    backgroundColor: globalColors.lightGrey2,
    borderRadius: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginBottom: globalMargins.tiny,
    overflow: 'hidden',
    position: 'relative',
    width: AVATAR_SIZE,
  },
})

export default EditAvatar
