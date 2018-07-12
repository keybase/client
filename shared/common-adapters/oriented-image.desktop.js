// @flow
import * as React from 'react'
import fs from 'fs'
import EXIF from 'exif-js'
import {noop, isNumber} from 'lodash-es'
import logger from '../logger'
import {Image} from '../common-adapters'
import type {Props} from './oriented-image.types'
import {collapseStyles} from '../styles'

type State = {
  styleTransform: string,
}

const NO_TRANSFORM = 'notransform'

const _cacheStyleTransforms: {[src: string]: string} = {}
// Orientations:
// 1: rotate 0 deg left
// 2: flip horizontally
// 3: rotate 180 deg left
// 4: flip vertically
// 5: flip vertically and rotate 270 degrees left
// 6: rotate 90 deg left
// 7: flip vertically and rotate 90 degrees left
// 8: rotate 270 deg left
const exifOrientaionMap = {
  '1': 'rotate(0deg)',
  '2': 'scale(-1, 1)',
  '3': 'rotate(180deg)',
  '4': 'scale(1, -1)',
  '5': 'scale(1, -1) rotate(270deg)',
  '6': 'rotate(90deg)',
  '7': 'scale(1, -1) rotate(90deg)',
  '8': 'rotate(270deg)',
}

const makeStyleTransform = (orientation: ?number): string => {
  // In the event that we get a missing orienation from EXIF library
  if (!orientation) return ''

  const transform = exifOrientaionMap[orientation]
  if (!transform) {
    logger.warn(`Invalid orientation value for desktop image attachment: orientation=${orientation}`)
    return ''
  }
  return transform
}

/*
 * OrientedImage handles two situations of reading EXIF orienation bits.
 * 1. When the user is adding an image, we want to render a preview of the
 * image with the correct exif orientation
 * 2. Once the image has been uploaded we will have to reorient the image again
 * while viewing in full screen (this is due to Chrome not respecting EXIF
 * orientation on images since 2012)
 *
 * When rendering a preview, the image location is on the user's file system.
 * That means that in order to read the raw image data for EXIF, we will need
 * to render the image into a canvas element and read the bytes using the
 * Canvas API. Croppie will take care of this and simply render the oriented
 * image in a canvas element for us.
 */
class OrientedImage extends React.Component<Props, State> {
  static defaultProps = {
    onLoad: noop,
    preview: false,
  }

  state = {
    styleTransform: _cacheStyleTransforms[this.props.src] || '',
  }

  _hasComponentMounted = false

  // Parse and update img exif data
  _readOrientation = (src, img) => {
    const orientation: ?number = EXIF.getTag(img, 'Orientation')
    // If there is no Orientation data set for the image, then mark it as null
    // in the cache to avoid subsequent calls to EXIF
    if (!isNumber(orientation)) {
      _cacheStyleTransforms[src] = NO_TRANSFORM
    }

    const newTransform: string = makeStyleTransform(orientation)
    this.setState(p => {
      if (p.styleTransform === newTransform) return undefined

      _cacheStyleTransforms[this.props.src] = newTransform
      return {styleTransform: newTransform}
    })
  }

  // EXIF will make a local HTTP request for images that have been uploaded to the Keybase service.
  // If the image is base64 encoded (local) it will read the exif data from the dataURI (no HTTP request)
  _readExifData = src => {
    return new Promise((resolve, reject) => {
      const ret = EXIF.getData({src}, function() {
        resolve(this)
      })
      if (!ret) reject(new Error('EXIF failed to fetch image data'))
    })
  }

  // When the user uploads a local image, we need to read the content directly
  // from the filesystem and encode the result as a base64 iamge so that EXIF
  // can process the orientation without attempting to make an HTTP request to
  // the local image which would violate CORS.
  _loadImageLocal = src => {
    return new Promise((resolve, reject) => {
      fs.readFile(src, (err, buffer) => {
        if (err) return reject(err)

        const imageBase64 = buffer.toString('base64')
        const dataURI = `data:image/jpeg;base64,${imageBase64}`
        resolve(dataURI)
      })
    })
  }

  _handleImageLoadSuccess = (src, img) => {
    if (!this._hasComponentMounted) return
    this._readOrientation(src, img)
  }

  // Don't perform transforms if the image cannot be loaded or there is no EXIF data
  _handleImgeLoadFailure = src => {
    _cacheStyleTransforms[src] = NO_TRANSFORM
  }

  _setTranformForExifOrientation(src) {
    if (!this._hasComponentMounted) return

    // This image either cannot be transofrmed or does not have an EXIF orientation flag
    if (_cacheStyleTransforms[src] === NO_TRANSFORM) {
      return
    }

    if (_cacheStyleTransforms[src]) {
      return this.setState({styleTransform: _cacheStyleTransforms[src]})
    }

    if (this.props.preview) {
      this._loadImageLocal(src)
        .then(dataURI => this._readExifData(dataURI))
        .then(img => this._handleImageLoadSuccess(src, img))
        .catch(() => this._handleImgeLoadFailure(src))
    } else {
      this._readExifData(src)
        .then(img => this._handleImageLoadSuccess(src, img))
        .catch(() => this._handleImgeLoadFailure(src))
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
    if (prevProps && prevProps.src !== this.props.src) {
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
