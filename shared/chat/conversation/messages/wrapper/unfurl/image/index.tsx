import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Constants from '../../../../../../constants/chat2'
import * as Styles from '../../../../../../styles'
import {imgMaxWidth} from '../../../attachment/image/image-render'
import {Video} from './video'
import openURL from '../../../../../../util/open-url'

export type Props = {
  autoplayVideo: boolean
  height: number
  isVideo: boolean
  linkURL?: string
  onClick?: () => void
  style?: Object
  url: string
  width: number
  widthPadding?: number
}

class UnfurlImage extends React.Component<Props> {
  _getDimensions() {
    const maxSize = Math.min(imgMaxWidth(), 320) - (this.props.widthPadding || 0)
    const {height, width} = Constants.clampImageSize(this.props.width, this.props.height, maxSize)
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
      <Video
        autoPlay={this.props.autoplayVideo}
        height={dims.height}
        onClick={this.props.onClick}
        style={style}
        url={this.props.url}
        width={dims.width}
      />
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
