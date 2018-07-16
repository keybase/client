// @flow
import * as React from 'react'
import fs from 'fs'
import EXIF from 'exif-js'
import {noop, isNumber} from 'lodash-es'
import logger from '../logger'
import {Image as ImageComponent} from '../common-adapters'
import type {Props} from './oriented-image.types'

type State = {
  srcTransformed: string,
}
type TransformFn = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => void

const uploadedSrc = /https?:\/\/127.0.0.1:.*$/i
const NO_TRANSFORM = 'notransform'
const _cacheNoTransforms: {[src: string]: string} = {}

// Define transformatin functions to operate on canvas elements
//
// 1: rotate 0 deg left
// 2: flip horizontally
// 3: rotate 180 deg left
// 4: flip vertically
// 5: flip vertically and rotate 270 degrees left
// 6: rotate 90 deg left
// 7: flip vertically and rotate 90 degrees left
// 8: rotate 270 deg left
const transformMap: {[orientation: string]: TransformFn} = {
  '1': noop,
  '2': (canvas, ctx, width, height) => {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  },
  '3': (canvas, ctx, width, height) => {
    ctx.translate(width, height)
    ctx.rotate(180 * Math.PI / 180)
  },
  '4': (canvas, ctx, width, height) => {
    ctx.translate(0, height)
    ctx.scale(1, -1)
  },
  '5': (canvas, ctx, width, height) => {
    canvas.width = height
    canvas.height = width
    ctx.rotate(90 * Math.PI / 180)
    ctx.scale(1, -1)
  },
  '6': (canvas, ctx, width, height) => {
    canvas.width = height
    canvas.height = width
    ctx.rotate(90 * Math.PI / 180)
    ctx.translate(0, -height)
  },
  '7': (canvas, ctx, width, height) => {
    canvas.width = height
    canvas.height = width
    ctx.rotate(-90 * Math.PI / 180)
    ctx.translate(-width, height)
    ctx.scale(1, -1)
  },
  '8': (canvas, ctx, width, height) => {
    canvas.width = height
    canvas.height = width
    ctx.translate(0, width)
    ctx.rotate(-90 * Math.PI / 180)
  },
}

/*
 * OrientedImage handles two situations of reading EXIF orientation bits.
 * 1. When the user is adding an image, we want to render a preview of the
 * image with the correct exif orientation
 * 2. Once the image has been uploaded we will have to reorient the image again
 * while viewing in full screen (this is due to Chrome not respecting EXIF
 * orientation on images since 2012)
 *
 * When rendering a preview, the image location on the user's filesystem we
 * read the data using fs and have EXIF read directly from the bytes.
 */
class OrientedImage extends React.Component<Props, State> {
  static defaultProps = {
    onLoad: noop,
    preview: false,
  }

  state = {srcTransformed: ''}

  /*
   * Instance Variables
   */
  _hasComponentMounted = false
  _canvasRef = null
  _context = null

  /*
   * Apply Styles
   */
  // Source: Foliotek/Croppie = https://github.com/Foliotek/Croppie/
  _drawCanvasOrientation = (img, orientation: number) => {
    // Convice flow that these will not be null for the remainder of this function
    if (!this._canvasRef || !this._context) return

    const ctx = this._context
    const canvas = this._canvasRef

    // We have to set the width/height of the canvas to correctly export it
    const width = img.naturalWidth
    const height = img.naturalHeight
    canvas.width = width
    canvas.height = height

    ctx.save()

    const transformFn = transformMap[orientation.toString()]
    if (!transformFn) {
      logger.warn(`Invalid orientation value for desktop image attachment: orientation=${orientation}`)
      return ''
    }
    // Appy transformation to canvas
    transformFn(canvas, ctx, width, height)

    ctx.drawImage(img, 0, 0)
    ctx.restore()

    // Get an image dataURI from the canvas
    // toDataURL(type, encoderOptions) is set to 1 to leave the image unencoded
    const imageData = canvas.toDataURL('image/jpeg', 1)
    this.setState(p => {
      if (p.srcTransformed === imageData) return undefined
      return {srcTransformed: imageData}
    })
  }

  _canvasImageTransform = (orientation: number) => {
    const {src} = this.props

    /* eslint-disable-next-line no-undef */
    const img = new Image()
    img.onload = () => this._drawCanvasOrientation(img, orientation)
    img.src = src
  }

  /*
   * Read/Fetch Image Data
   */

  // EXIF will make a local HTTP request for images that have been uploaded to the Keybase service.
  _fetchExifUploaded = () => {
    const {src} = this.props
    return new Promise((resolve, reject) => {
      const ret = EXIF.getData({src}, function() {
        const orientation = EXIF.getTag(this, 'Orientation')
        resolve(orientation)
      })
      if (!ret) reject(new Error('EXIF failed to fetch image data'))
    })
  }

  // Read the file contents directly into a buffer and pass it to EXIF which
  // can extract the EXIF data
  _readExifLocal = () => {
    const {src} = this.props
    return new Promise((resolve, reject) => {
      // data is a Node Buffer which is backed by a JavaScript ArrayBuffer.
      // EXIF.readFromBinaryFile takes an ArrayBuffer
      const data = fs.readFileSync(src)
      const tags = EXIF.readFromBinaryFile(data.buffer)
      tags ? resolve(tags['Orientation']) : reject(new Error('EXIF failed to read exif data'))
    })
  }

  _handleOrientationSuccess = orientation => {
    if (!this._hasComponentMounted) return

    // If there is no Orientation data set for the image, then mark it as null
    // in the cache to avoid subsequent calls to EXIF
    if (!orientation || !isNumber(orientation)) {
      return this._handleOrientationFailure()
    }

    this._canvasImageTransform(orientation)
  }

  // Mark this image path as no transform and set the ImageComponent src to the original source
  _handleOrientationFailure = () => {
    _cacheNoTransforms[this.props.src] = NO_TRANSFORM
    this.setState({srcTransformed: this.props.src})
  }

  _setTranformForExifOrientation = () => {
    if (!this._hasComponentMounted) return

    // This image either cannot be transofrmed or does not have an EXIF orientation flag
    if (_cacheNoTransforms[this.props.src] === NO_TRANSFORM) {
      this._handleOrientationFailure()
    }

    // Uploaded file served from Keybase service
    if (uploadedSrc.test(this.props.src)) {
      this._fetchExifUploaded()
        .then(orientation => this._handleOrientationSuccess(orientation))
        .catch(this._handleOrientationFailure)
    } else {
      this._readExifLocal()
        .then(orientation => this._handleOrientationSuccess(orientation))
        .catch(this._handleOrientationFailure)
    }
  }

  /*
   * Lifecyle Hooks
   */
  componentDidMount() {
    this._hasComponentMounted = true
    if (this._canvasRef) {
      this._context = this._canvasRef.getContext('2d')
      this._setTranformForExifOrientation()
    }
  }

  componentWillUnmount() {
    this._hasComponentMounted = false
    this._canvasRef = null
    this._context = null
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // New src requires changing EXIF transform
    if (prevProps && prevProps.src !== this.props.src) {
      this._setTranformForExifOrientation()
    }
  }

  /*
   * Render Methods
   */
  render() {
    return (
      <React.Fragment>
        <canvas ref={el => (this._canvasRef = el)} style={styleCanvas} />
        {this.state.srcTransformed && (
          <ImageComponent
            src={this.state.srcTransformed}
            style={this.props.style}
            onLoad={this.props.onLoad}
          />
        )}
      </React.Fragment>
    )
  }
}

const styleCanvas = {
  display: 'none',
}

export default OrientedImage
