import * as React from 'react'
import * as Styles from '../styles'
import {Image, ImageProps} from 'react-native'
import RNFI, {Source} from 'react-native-fast-image'
import isArray from 'lodash/isArray'
import LoadingStateView from './loading-state-view'

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

    let source: Source
    if (isArray(this.props.source)) {
      source = {uri: this.props.source[0].uri} // TODO smarter choice?
    } else {
      source = {uri: this.props.source.uri}
    }

    if (!source || !source.uri) {
      return null
    }

    // TODO maybe use reanimated2
    const opacity = this.props.showLoadingStateUntilLoaded && this.state.loading ? 0 : 1

    return (
      <>
        <RNFI
          {...(this.props as any)}
          style={Styles.collapseStyles([
            this.props.style,
            this.props.showLoadingStateUntilLoaded && this.state.loading && styles.absolute,
            {opacity},
          ] as const)}
          onLoadStart={this._onLoadStart}
          onLoadEnd={this._onLoadEnd}
          onProgress={this._onProgress}
          source={source}
        />
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
