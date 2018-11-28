// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters/mobile.native'
import {type ImageViewProps} from './image-view'

const {width: screenWidth, height: screenHeight} = Kb.NativeDimensions.get('window')

class ImageView extends React.Component<
  ImageViewProps,
  {...ImageViewProps, width: number, height: number, loaded: boolean}
> {
  state = {height: 0, width: 0, loaded: false}
  _mounted: boolean = false

  componentWillUnmount() {
    this._mounted = false
  }
  componentDidMount() {
    this._mounted = true
    Kb.NativeImage.getSize(this.props.url, (width, height) => {
      if (this._mounted) {
        this.setState({height, width})
      }
    })
  }

  _setLoaded = () => this.setState({loaded: true})

  render() {
    const {onLoadingStateChange} = this.props
    return (
      <Kb.ZoomableBox
        contentContainerStyle={styles.zoomableBoxContainer}
        maxZoom={10}
        style={styles.zoomableBox}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Kb.NativeFastImage
          source={{uri: this.props.url}}
          style={Styles.collapseStyles([
            styles.image,
            {
              height: Math.min(this.state.height, screenHeight),
              width: Math.min(this.state.width, screenWidth),
            },
          ])}
          onLoadStart={onLoadingStateChange && (() => onLoadingStateChange(true))}
          onLoadEnd={onLoadingStateChange && (() => onLoadingStateChange(false))}
          resizeMode="contain"
        />
      </Kb.ZoomableBox>
    )
  }
}

const styles = Styles.styleSheetCreate({
  image: {
    flex: 1,
    alignSelf: 'center',
  },
  zoomableBox: {
    flex: 1,
    position: 'relative',
  },
  zoomableBoxContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
})

export default ImageView
