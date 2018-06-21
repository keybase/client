// @flow
import * as React from 'react'
import EXIF from 'exif-js'
import {noop, isNumber} from 'lodash-es'
import logger from '../logger'
import {Image} from '../common-adapters'
import {type Props} from './oriented-image.types'
import {collapseStyles} from '../styles'

type State = {
  styleTransform: string,
}

let _cacheStyleTransforms: {[src: string]: string} = {}
// Orientations:
// 1: rotate 0 deg left
// 2: flip horizontally
// 3: rotate 180 deg left
// 4: flip vertically
// 5: flip vertically and rotate 90 degrees left
// 6: rotate 90 deg left
// 7: flip vertically and rotate 270 degrees left
// 8: rotate 270 deg left
const exifOrientaionMap = {
  '1': 'rotate(0deg)',
  '2': 'scale(-1, 1)',
  '3': 'rotate(180deg)',
  '4': 'scale(1, -1)',
  '5': 'scale(1, -1) rotate(90deg)',
  '6': 'rotate(90deg)',
  '7': 'scale(1, -1) rotate(90deg)',
  '8': 'rotate(270deg)',
}

const makeStyleTransform = (orientation: number): string => {
  const transform = exifOrientaionMap[orientation]
  if (!transform) {
    logger.warn('Invalid orientation value for desktop image attachment')
    return ''
  }
  return transform
}

class OrientedImage extends React.Component<Props, State> {
  static defaultProps = {
    onLoad: noop,
  }

  state = {
    styleTransform: _cacheStyleTransforms[this.props.src] || '',
  }

  _hasComponentMounted = false

  _handleData = img => {
    const orientation: number = EXIF.getTag(img, 'Orientation')
    // EXIF.getTag can return undefined for Orientation if the field is not found
    if (isNumber(orientation)) {
      const newTransform: string = makeStyleTransform(orientation)
      this.setState(p => (p.styleTransform === newTransform ? undefined : {styleTransform: newTransform}))
    }
  }

  _setTranformForExifOrientation(src) {
    if (!this._hasComponentMounted) {
      return
    }

    if (_cacheStyleTransforms[src]) {
      return this.setState({
        styleTransform: _cacheStyleTransforms[src],
      })
    }

    // EXIF will make an HTTP request locally to 127.0.0.1:* to fetch the
    // image that the keybase service is serving
    // img = this refers to the image ArrayBuffer fetched from the local server.
    const handleData = this._handleData
    EXIF.getData({src}, function() {
      handleData(this)
    })
  }

  componentDidMount() {
    this._hasComponentMounted = true
    this._setTranformForExifOrientation(this.props.src)
  }

  componentWillUnmount() {
    this._hasComponentMounted = false
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // New src requires changing EXIF transform
    if (
      prevProps &&
      prevProps.src !== this.props.src &&
      this.state.styleTransform !== prevState.styleTransform &&
      this.state.styleTransform !== _cacheStyleTransforms[this.props.src]
    ) {
      this._setTranformForExifOrientation(this.props.src)
    }
  }

  render() {
    return (
      <Image
        src={this.props.src}
        style={collapseStyles([this.props.style, {transform: this.state.styleTransform}])}
        onLoad={this.props.onLoad}
      />
    )
  }
}

export default OrientedImage
