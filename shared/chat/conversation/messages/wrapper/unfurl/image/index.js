// @flow
import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Styles from '../../../../../../styles'
import {clamp} from 'lodash-es'
import {imgMaxWidth} from '../../../attachment/image/image-render'
import {Video} from './video'
import openURL from '../../../../../../util/open-url'

export type Props = {
  height: number,
  width: number,
  widthPadding?: number,
  url: string,
  linkURL?: string,
  isVideo: boolean,
  autoplayVideo: boolean,
  style?: Object,
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
    const maxSize = Math.min(imgMaxWidth(), 320) - (this.props.widthPadding || 0)
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
  _onClick = () => {
    if (this.props.linkURL) {
      openURL(this.props.linkURL)
    }
  }

  render() {
    const dims = this._getDimensions()
    const style = Styles.collapseStyles([dims, styles.image, this.props.style])
    return this.props.isVideo ? (
      <Video {...dims} autoPlay={this.props.autoplayVideo} style={style} url={this.props.url} />
    ) : (
      <Kb.ClickableBox onClick={this._onClick}>
        <Kb.Image {...dims} src={this.props.url} style={style} />
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
