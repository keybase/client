// @flow
import * as React from 'react'
import {Box, Button, ButtonBar, StandardScreen} from '../../common-adapters'
import {NativeDimensions, NativeImage, ZoomableBox} from '../../common-adapters/mobile.native'
import {globalColors, globalStyles, globalMargins, platformStyles} from '../../styles'
import type {Props} from '.'

const {width: screenWidth, height: screenHeight} = NativeDimensions.get('window')

class AutoMaxSizeImage extends React.Component<any, {width: number, height: number, loaded: boolean}> {
  state = {height: 0, width: 0, loaded: false}
  _mounted: boolean = false

  componentWillUnmount() {
    this._mounted = false
  }
  componentDidMount() {
    this._mounted = true
    NativeImage.getSize(this.props.source.uri, (width, height) => {
      if (this._mounted) {
        this.setState({height, width})
      }
    })
  }

  _setLoaded = () => this.setState({loaded: true})

  render() {
    return (
      <ZoomableBox
        contentContainerStyle={{flex: 1, position: 'relative'}}
        maxZoom={10}
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: 250,
          height: 250,
          borderRadius: 250,
          backgroundColor: globalColors.lightGrey2,
          marginBottom: globalMargins.tiny,
        }}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <NativeImage
          {...this.props}
          resizeMode="cover"
          style={{
            flex: 1,
            height: Math.min(this.state.height, screenHeight),
            width: Math.min(this.state.width, screenWidth),
            alignSelf: 'center',
            opacity: this.props.opacity,
          }}
        />
      </ZoomableBox>
    )
  }
}

class EditAvatar extends React.Component<Props> {
  _onSave = () => {
    this.props.onSave(this.props.filename)
  }

  render() {
    return (
      <StandardScreen style={container} onCancel={this.props.onClose} title="Zoom and pan">
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            alignItems: 'center',
            marginBottom: globalMargins.small,
            marginTop: globalMargins.small,
          }}
        >
          <AutoMaxSizeImage source={{uri: this.props.filename}} />
          <ButtonBar direction="column">
            <Button
              type="Primary"
              fullWidth={true}
              onClick={this._onSave}
              label="Save"
              style={{width: '100%', marginTop: globalMargins.tiny}}
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
