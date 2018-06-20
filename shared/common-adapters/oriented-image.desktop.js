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
// 3: rotate 180 deg left
// 6: rotate 270 deg left
// 8: rotate 90 deg left
const exifOrientaionMap = {
  '1': {transform: 'rotate(0deg)'},
  '3': {transform: 'rotate(180deg)'},
  '6': {transform: 'rotate(270deg)'},
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
    if (!this.state.styleTransform) {
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
    return this.state.styleTransform ? (
      <Image
        src={this.props.src}
        style={collapseStyles([this.props.style, this.state.styleTransform])}
        onLoad={this._handleOnLoad}
      />
    ) : null
  }
}

export default OrientedImage
