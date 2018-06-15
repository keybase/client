// @flow
import * as React from 'react'
import {Box, ButtonBar, StandardScreen, WaitingButton} from '../../common-adapters'
import {NativeImage, ZoomableBox} from '../../common-adapters/mobile.native'
import {globalColors, globalStyles, globalMargins, platformStyles} from '../../styles'
import type {Props} from '.'

class EditAvatar extends React.Component<Props> {
  _onSave = () => {
    // this.props.onSave(this.props.filename)
  }

  render() {
    console.log('SPOONER', this.props.image)

    return (
      <StandardScreen
        style={container}
        onCancel={this.props.onClose}
        title="Zoom and pan"
        scrollEnabled={false}
      >
        <Box
          style={{
            alignItems: 'center',
            marginBottom: globalMargins.small,
            marginTop: globalMargins.small,
          }}
        >
          <Box
            style={{
              backgroundColor: globalColors.lightGrey2,
              borderRadius: 250,
              height: 250,
              marginBottom: globalMargins.tiny,
              overflow: 'hidden',
              position: 'relative',
              width: 250,
            }}
          >
            <ZoomableBox
              maxZoom={10}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={{
                height: 250,
                width: 250,
              }}
            >
              <NativeImage
                source={{uri: `data:image/jpeg;base64,${this.props.image.data}`}}
                resizeMode="contain"
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
              type="Primary"
              fullWidth={true}
              onClick={this._onSave}
              label="Save"
              style={{width: '100%', marginTop: globalMargins.tiny}}
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

export default EditAvatar
