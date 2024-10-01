import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import CommandMarkdown from '../../command-markdown/container'
import CommandStatus from '../../command-status/container'
import Giphy from '../../giphy/container'
// import PlatformInput from './platform-input'
import ReplyPreview from '../../reply-preview'
// import type * as T from '@/constants/types'
// import {indefiniteArticle} from '@/util/string'
import {infoPanelWidthTablet} from '../../info-panel/common'
// import {assertionToDisplay} from '@/common-adapters/usernames'
// import {FocusContext, ScrollContext} from '@/chat/conversation/normal/context'
// import type {RefType as Input2Ref} from '@/common-adapters/input2'

const Input = React.memo(function () {
  const showGiphySearch = C.useChatContext(s => s.giphyWindow)
  const showCommandMarkdown = C.useChatContext(s => !!s.commandMarkdown)
  const showCommandStatus = C.useChatContext(s => !!s.commandStatus)
  const showReplyTo = C.useChatContext(s => !!s.messageMap.get(s.replyTo)?.id)
  return (
    <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
      {showReplyTo && <ReplyPreview />}
      {/*TODO move this into suggestors*/ showCommandMarkdown && <CommandMarkdown />}
      {showCommandStatus && <CommandStatus />}
      {showGiphySearch && <Giphy />}
      {/*<ConnectedPlatformInput />*/}
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isMobile: {justifyContent: 'flex-end'},
      }),
      suggestionOverlay: Kb.Styles.platformStyles({
        isElectron: {marginLeft: 15, marginRight: 15, marginTop: 'auto'},
        isTablet: {marginLeft: '30%', marginRight: 0},
      }),
      suggestionOverlayInfoShowing: Kb.Styles.platformStyles({
        isElectron: {marginLeft: 15, marginRight: 15, marginTop: 'auto'},
        isTablet: {marginLeft: '30%', marginRight: infoPanelWidthTablet},
      }),
    }) as const
)

export default Input
