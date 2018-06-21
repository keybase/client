// @flow
import * as React from 'react'
import {NativeImage, NativeDimensions, ZoomableBox} from '../../common-adapters/mobile.native'
import {type ImageViewProps} from './image-view'

const {width: screenWidth, height: screenHeight} = NativeDimensions.get('window')

class ImageView extends React.Component<any, {...ImageViewProps, width: number, height: number, loaded: boolean}> {
  state = {height: 0, width: 0, loaded: false}
  _mounted: boolean = false

  componentWillUnmount() {
    this._mounted = false
  }
  componentDidMount() {
    this._mounted = true
    NativeImage.getSize(this.props.url, (width, height) => {
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
        style={{position: 'relative', overflow: 'hidden', width: '100%', height: '100%'}}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <NativeImage
          source={{uri: this.props.url}}
          style={{
            ...stylesImage,
            height: Math.min(this.state.height, screenHeight),
            width: Math.min(this.state.width, screenWidth),
          }}
          resizeMode="contain" />
      </ZoomableBox>
    )
  }
}

const stylesImage = {
  flex: 1,
  alignSelf: 'center',
}

export default ImageView
