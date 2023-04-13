import * as React from 'react'
import * as Kb from '../../../../../../../common-adapters/index'
import * as Constants from '../../../../../../../constants/chat2'
import * as Styles from '../../../../../../../styles'
import {maxWidth} from '../../../../../messages/attachment/shared'
import {Video} from './video'
import openURL from '../../../../../../../util/open-url'

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

const UnfurlImage = (p: Props) => {
  const {autoplayVideo, isVideo, linkURL, onClick, url, style, widthPadding} = p

  const onOpenURL = React.useCallback(() => {
    linkURL && openURL(linkURL)
  }, [linkURL])
  const maxSize = Math.min(maxWidth, 320) - (widthPadding || 0)
  const {height, width} = Constants.clampImageSize(p.width, p.height, maxSize, 320)

  return isVideo ? (
    <Video
      autoPlay={autoplayVideo}
      height={height}
      onClick={onClick}
      style={Styles.collapseStyles([
        styles.image,
        {height, minHeight: height, minWidth: width, width},
        style,
      ])}
      url={url}
      width={width}
    />
  ) : (
    <Kb.ClickableBox onClick={onClick || onOpenURL}>
      <Kb.Image
        src={url}
        style={Styles.collapseStyles([
          styles.video,
          {height, minHeight: height, minWidth: width, width},
          style,
        ])}
      />
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      image: {
        borderRadius: Styles.borderRadius,
        flexGrow: 0,
        flexShrink: 0,
      },
      video: {
        flexGrow: 0,
        flexShrink: 0,
      },
    } as const)
)

export default UnfurlImage
