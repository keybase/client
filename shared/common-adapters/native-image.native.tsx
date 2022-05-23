import * as React from 'react'
import * as Styles from '../styles'
import {Image, type ImageProps} from 'react-native'
import RNFI, {type OnProgressEvent} from 'react-native-fast-image'
import isArray from 'lodash/isArray'
import LoadingStateView from './loading-state-view'
import {memoize} from '../util/memoize'
import isEqual from 'lodash/isEqual'

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

class FastImageImpl extends React.PureComponent<
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

  private onLoadStart = () => {
    this._mounted && this.setState({loading: true})
    this.props.onLoadStart?.()
  }
  private onLoadEnd = () => {
    this._mounted && this.setState({loading: false})
    this.props.onLoadEnd?.()
  }
  private onProgress = (evt: OnProgressEvent) => {
    this._mounted && this.setState({progress: evt.nativeEvent?.loaded / evt.nativeEvent?.total || 0})
    this.props.onProgress?.(evt as any)
  }

  private getStyle = memoize((style, loading) => {
    return Styles.collapseStyles([style, loading ? styles.loading : styles.loaded] as const)
  }, isEqual)

  private getSource = memoize(source =>
    isArray(source)
      ? {uri: source[0].uri} // TODO smarter choice?
      : {uri: source.uri}
  )

  render() {
    if (typeof this.props.source === 'number') {
      return null
    }

    const source = this.getSource(this.props.source)

    if (!source.uri) {
      return null
    }

    // TODO maybe use reanimated2
    return (
      <>
        <RNFI
          {...(this.props as any)}
          style={this.getStyle(
            this.props.style,
            this.props.showLoadingStateUntilLoaded && this.state.loading
          )}
          onLoadStart={this.onLoadStart}
          onLoadEnd={this.onLoadEnd}
          onProgress={this.onProgress}
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
  loaded: {opacity: 1},
  loading: {opacity: 0, position: 'absolute'},
}))

export const FastImage = FastImageImpl
