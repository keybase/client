import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'

export type Props = {
  openFullscreen?: () => void
  showPopup?: () => void
  allowPlay: boolean
  message: T.Chat.MessageAttachment
}

export const usePosterState = (url: string) => {
  const [showPoster, setShowPoster] = React.useState(true)
  const [lastUrl, setLastUrl] = React.useState(url)
  if (lastUrl !== url) {
    setLastUrl(url)
    setShowPoster(true)
  }
  return {showPoster, reveal: () => setShowPoster(false)}
}

export const sharedStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      durationContainer: {
        alignSelf: 'flex-end',
        backgroundColor: Kb.Styles.globalColors.black_50,
        borderRadius: 2,
        bottom: Kb.Styles.globalMargins.tiny,
        padding: 1,
        position: 'absolute',
        right: Kb.Styles.globalMargins.tiny,
      },
      durationText: {
        color: Kb.Styles.globalColors.white,
        paddingLeft: 3,
        paddingRight: 3,
      },
      playButton: {
        left: '50%',
        marginLeft: -32,
        marginTop: -32,
        position: 'absolute',
        top: '50%',
      },
    }) as const
)
