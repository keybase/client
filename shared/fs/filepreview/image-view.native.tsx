import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters/mobile.native'
import type {ImageViewProps} from './image-view'

const {width: screenWidth, height: screenHeight} = Kb.NativeDimensions.get('window')

type State = {
  width: number
  height: number
}
// TODO: I don't understand why the props were being included in the state
//  so I took them out. Someone should sanity check that.

class ImageView extends React.Component<ImageViewProps, State> {
  state = {height: 0, width: 0}
  _mounted: boolean = false

  componentWillUnmount() {
    this._mounted = false
  }
  componentDidMount() {
    this._mounted = true
    Kb.NativeImage.getSize(
      this.props.url,
      (width, height) => {
        if (this._mounted) {
          this.setState({height, width})
        }
      },
      () => {}
    )
  }

  render() {
    const {onUrlError} = this.props
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
          showLoadingStateUntilLoaded={true}
          onError={onUrlError && (() => onUrlError('image fetching error'))}
          resizeMode="contain"
        />
      </Kb.ZoomableBox>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      image: {
        alignSelf: 'center',
        flex: 1,
      },
      zoomableBox: {
        flex: 1,
        position: 'relative',
      },
      zoomableBoxContainer: {
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      },
    } as const)
)

export default ImageView
