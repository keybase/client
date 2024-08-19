import * as React from 'react'
import * as Kb from '@/common-adapters/index'
import * as C from '@/constants'
import {maxWidth} from '@/chat/conversation/messages/attachment/shared'
import {Video} from './video'
import openURL from '@/util/open-url'

export type Props = {
  autoplayVideo: boolean
  height: number
  isVideo: boolean
  linkURL?: string
  onClick?: () => void
  style?: object
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
  const {height, width} = C.Chat.clampImageSize(p.width, p.height, maxSize, 320)

  return isVideo ? (
    <Video
      autoPlay={autoplayVideo}
      height={height}
      onClick={onClick}
      style={
        Kb.Styles.collapseStyles([
          styles.image,
          {height, minHeight: height, minWidth: width, width},
          style,
        ]) as React.CSSProperties
      }
      url={url}
      width={width}
    />
  ) : (
    <Kb.ClickableBox onClick={onClick || onOpenURL}>
      <Kb.Image2
        src={url}
        style={Kb.Styles.collapseStyles([
          styles.video,
          {height, minHeight: height, minWidth: width, width},
          style,
        ])}
      />
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      image: {
        borderRadius: Kb.Styles.borderRadius,
        flexGrow: 0,
        flexShrink: 0,
      },
      video: {
        flexGrow: 0,
        flexShrink: 0,
      },
    }) as const
)

export default UnfurlImage
