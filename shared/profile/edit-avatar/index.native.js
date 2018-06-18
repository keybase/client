// @flow
import * as React from 'react'
import {Box, ButtonBar, StandardScreen, WaitingButton} from '../../common-adapters'
import {NativeImage, ZoomableBox} from '../../common-adapters/mobile.native'
import {globalColors, globalStyles, globalMargins, platformStyles, styleSheetCreate} from '../../styles'
import {isIOS} from '../../constants/platform'
import type {Props} from '.'

const AVATAR_SIZE = 250

class EditAvatar extends React.Component<Props> {
  _zoom: ?ZoomableBox

  _onSave = () => {
    const filename = isIOS ? this.props.image.uri.replace('file://', '') : this.props.image.path
    const crop = isIOS ? this._getIOSCrop() : this._getAndroidCrop()
    this.props.onSave(filename, crop)
  }

  _getAndroidCrop = () => {
    const x = -this._zoom.state.pan.x
    const y = -this._zoom.state.pan.y
    const scale = this._zoom.state.scale - 1
    const rH = this.props.image.height * scale
    const rW = this.props.image.width * scale
    const x0 = rW * x
    const y0 = rH * y
    return {
      x0: Math.round(x0),
      y0: Math.round(y0),
      x1: Math.round(x0 + AVATAR_SIZE * rW),
      y1: Math.round(y0 + AVATAR_SIZE * rH),
    }
  }

  _getIOSCrop = () => {
    const x = this._zoom.state.offsetX
    const y = this._zoom.state.offsetY
    const rH = this.props.image.height / this._zoom.state.height
    const rW = this.props.image.width / this._zoom.state.width
    const x0 = rW * x
    const y0 = rH * y
    return {
      x0: Math.round(x0),
      y0: Math.round(y0),
      x1: Math.round(x0 + AVATAR_SIZE * rW),
      y1: Math.round(y0 + AVATAR_SIZE * rH),
    }
  }

  _zoomRef = (ref: ?ZoomableBox) => {
    this._zoom = ref
  }

  render() {
    return (
      <StandardScreen
        onCancel={this.props.onClose}
        scrollEnabled={false}
        style={container}
        title="Zoom and pan"
      >
        <Box
          style={{
            alignItems: 'center',
            marginBottom: globalMargins.small,
            marginTop: globalMargins.small,
          }}
        >
          <Box style={styles.zoomContainer}>
            <ZoomableBox
              maxZoom={10}
              ref={this._zoomRef}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={styles.imageContainer}
            >
              <NativeImage
                resizeMode="contain"
                source={{uri: `data:image/jpeg;base64,${this.props.image.data}`}}
                style={{
                  alignSelf: 'center',
                  flex: 1,
                  height: this.props.image.height,
                  width: this.props.image.width,
                }}
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

const container = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    flex: 1,
  },
})

const styles = styleSheetCreate({
  button: {
    marginTop: globalMargins.tiny,
    width: '100%',
  },
  imageContainer: {
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
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
