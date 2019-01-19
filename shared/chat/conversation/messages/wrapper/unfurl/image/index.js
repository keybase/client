// @flow
import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Styles from '../../../../../../styles'
import {clamp} from 'lodash-es'
import {imgMaxWidth} from '../../../attachment/image/image-render'
import {Video} from './video'

export type Props = {
  autoplayVideo: boolean,
  height: number,
  hidePlayButton?: boolean,
  isVideo: boolean,
  maxSize?: number,
  onClick?: () => void,
  url: string,
  style?: Object,
  width: number,
  widthPadding?: number,
}

const clampImageSize = ({width = 0, height = 0}, maxSize) =>
  height > width
    ? {
        height: clamp(height || 0, 0, maxSize),
        width: (clamp(height || 0, 0, maxSize) * width) / (height || 1),
      }
    : {
        height: (clamp(width || 0, 0, maxSize) * height) / (width || 1),
        width: clamp(width || 0, 0, maxSize),
      }

class UnfurlImage extends React.Component<Props> {
  _getDimensions() {
    const maxSize =
      Math.min(imgMaxWidth(), this.props.maxSize ? this.props.maxSize : 320) - (this.props.widthPadding || 0)
    const {height, width} = clampImageSize({height: this.props.height, width: this.props.width}, maxSize)
    return {
      flexGrow: 0,
      flexShrink: 0,
      height,
      minHeight: height,
      minWidth: width,
      width,
    }
  }

  render() {
    const dims = this._getDimensions()
    const style = Styles.collapseStyles([dims, styles.image, this.props.style])
    return this.props.isVideo ? (
      <Video
        autoPlay={this.props.autoplayVideo}
        height={dims.height}
        hidePlayButton={this.props.hidePlayButton}
        onClick={this.props.onClick}
        style={style}
        url={this.props.url}
        width={dims.width}
      />
    ) : (
      <Kb.ClickableBox onClick={this.props.onClick} style={dims}>
        <Kb.Image src={this.props.url} style={style} />
      </Kb.ClickableBox>
    )
  }
}

const styles = Styles.styleSheetCreate({
  image: {
    borderRadius: Styles.borderRadius,
  },
})

export default UnfurlImage
