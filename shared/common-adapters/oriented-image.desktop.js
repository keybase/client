// @flow
import * as React from 'React'
import EXIF from 'exif-js'
import {noop, inRange} from 'lodash-es'
import {Image} from '../common-adapters'
import {type Props} from './oriented-image'
import {collapseStyles, type StylesDesktop} from '../styles'

type State = {
  styleTransform: StylesDesktop | null,
}

const makeStyleTransform = (orientation: number): StylesDesktop =>
  exifOrientaionMap[orientation] || {transform: 'rotate(0deg)'}

// Orientations:
// 1: rotate 0 deg left
// 2: flip horizontally
// 3: rotate 180 deg left
// 4: flip vertivally
// 5: flip vertivally and rotate 270 degrees left
// 6: rotate 270 deg left
// 7: flip vertically and rotate 90 degrees left
// 8: rotate 90 deg left
const exifOrientaionMap = {
  '1': {transform: 'rotate(0deg)'},
  '2': {transform: 'scale(-1, 1)'},
  '3': {transform: 'rotate(180deg)'},
  '4': {transform: 'scale(1, -1)'},
  '5': {transform: 'scale(1, -1) rotate(270deg)'},
  '6': {transform: 'rotate(270deg)'},
  '7': {transform: 'scale(1, -1) rotate(90deg)'},
  '8': {transform: 'rotate(90deg)'},
}

class OrientedImage extends React.Component<Props, State> {
  static defaultProps = {
    onLoad: noop,
  }
  state = {
    styleTransform: null,
  }
  _handleOnLoad = () => {
    if (this.state.styleTransform !== null) {
      this.props.onLoad()
    }
  }
  componentDidMount() {
    const component = this
    EXIF.getData({src: this.props.src}, function() {
      const img = this
      const orientation: number = EXIF.getTag(img, 'Orientation')
      if (orientation && inRange(orientation, 1, 9)) {
        const transform: StylesDesktop = makeStyleTransform(orientation)
        component.setState({styleTransform: transform})
      }
    })
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
