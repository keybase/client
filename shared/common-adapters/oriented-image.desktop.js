// @flow
import * as React from 'react'
import EXIF from 'exif-js'
import {noop, isNumber} from 'lodash-es'
import logger from '../logger'
import {Image} from '../common-adapters'
import {type Props} from './oriented-image.types'
import {collapseStyles} from '../styles'

type Transform = {
  transform: string,
}

type State = {
  cacheStyleTransforms: {[url: string]: Transform},
  styleTransform: {transform: string},
}

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
  '1': {transform: 'rotate(0deg)'},
  '2': {transform: 'scale(-1, 1)'},
  '3': {transform: 'rotate(180deg)'},
  '4': {transform: 'scale(1, -1)'},
  '5': {transform: 'scale(1, -1) rotate(90deg)'},
  '6': {transform: 'rotate(90deg)'},
  '7': {transform: 'scale(1, -1) rotate(90deg)'},
  '8': {transform: 'rotate(270deg)'},
}

const makeStyleTransform = (orientation: number): Transform => {
  const transform = exifOrientaionMap[orientation]
  if (!transform) {
    logger.warn('Invalid orientation value for desktop image attachment')
    return {transform: ''}
  }
  return transform
}

class OrientedImage extends React.Component<Props, State> {
  static defaultProps = {
    onLoad: noop,
  }

  state = {
    cacheStyleTransforms: {},
    styleTransform: {transform: ''},
  }

  _hasComponentMounted = false

  _setTranformForExifOrientation(src) {
    if (this._hasComponentMounted) {
      if (this.state.cacheStyleTransforms[src]) {
        return this.setState({
          styleTransform: this.state.cacheStyleTransforms[src],
        })
      }

      const component = this
      // EXIF will make an HTTP request locally to 127.0.0.1:* to fetch the
      // image that the keybase service is serving
      // img = this refers to the image ArrayBuffer fetched from the local server.
      EXIF.getData({src}, function() {
        const img = this
        const orientation: number = EXIF.getTag(img, 'Orientation')
        // EXIF.getTag can return undefined for Orientation if the field is not found
        if (isNumber(orientation)) {
          const styleTransform: Transform = makeStyleTransform(orientation)
          component.setState(prevState => {
            const newTransform =
              prevState.styleTransform.transform !== styleTransform.transform
                ? styleTransform
                : prevState.styleTransform
            return {
              cacheStyleTransforms: {[src]: newTransform},
              styleTransform: newTransform,
            }
          })
        }
      })
    }
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
      this.state.styleTransform.transform !== prevState.styleTransform.transform &&
      this.state.styleTransform !== this.state.cacheStyleTransforms[this.props.src]
    ) {
      this._setTranformForExifOrientation(this.props.src)
    }
  }

  render() {
    return (
      <Image
        src={this.props.src}
        style={collapseStyles([this.props.style, this.state.styleTransform])}
        onLoad={this.props.onLoad}
      />
    )
  }
}

export default OrientedImage
