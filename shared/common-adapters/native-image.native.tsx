import * as React from 'react'
import * as Styles from '../styles'
import {Image, ImageProps, ImageURISource} from 'react-native'
import RNFI from 'react-native-fast-image'
import isArray from 'lodash/isArray'
import LoadingStateView from './loading-state-view'
import Animated from './animated'

export class NativeImage extends React.Component<ImageProps> {
  static getSize = Image.getSize
  render() {
    return <Image {...this.props} fadeDuration={0} />
  }
}

type FastImageImplState = {
  loading: boolean
  progress: number
}

class FastImageImpl extends React.Component<
  ImageProps & {showLoadingStateUntilLoaded?: boolean},
  FastImageImplState
> {
  static resizeMode = RNFI.resizeMode
  static getSize = Image.getSize
  state = {
    loading: true,
    progress: 0,
  }

  _mounted = true
  componentWillUnmount() {
    this._mounted = false
  }

  _onLoadStart = () => {
    this._mounted && this.setState({loading: true})
    this.props.onLoadStart && this.props.onLoadStart()
  }
  _onLoadEnd = () => {
    this._mounted && this.setState({loading: false})
    this.props.onLoadEnd && this.props.onLoadEnd()
  }
  _onProgress = evt => {
    this._mounted && this.setState({progress: evt.nativeEvent?.loaded / evt.nativeEvent?.total || 0})
    this.props.onProgress && this.props.onProgress(evt)
  }
  render() {
    if (typeof this.props.source === 'number') {
      return null
    }

    let source: ImageURISource
    if (isArray(this.props.source)) {
      source = this.props.source[0] // TODO smarter choice?
    } else {
      source = this.props.source
    }

    if (!source || !source.uri) {
      return null
    }
    return (
      <>
        <Animated to={{opacity: this.props.showLoadingStateUntilLoaded && this.state.loading ? 0 : 1}}>
          {({opacity}) => (
            <RNFI
              {...this.props}
              style={Styles.collapseStyles([
                this.props.style,
                this.props.showLoadingStateUntilLoaded && this.state.loading && styles.absolute,
                {opacity},
              ])}
              onLoadStart={this._onLoadStart}
              onLoadEnd={this._onLoadEnd}
              onProgress={this._onProgress}
              source={source}
            />
          )}
        </Animated>
        {this.props.showLoadingStateUntilLoaded ? (
          <LoadingStateView loading={this.state.loading} progress={this.state.progress} white={true} />
        ) : null}
      </>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  absolute: {
    position: 'absolute',
  },
}))

export const FastImage = FastImageImpl
