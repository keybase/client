import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useNavigation} from '@react-navigation/native'
import * as T from '@/constants/types'

type Props = {
  conversationIDKey?: T.Chat.ConversationIDKey
  messageID: T.Chat.MessageID
  url?: string
}
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
import {attachmentDownloadMessage, takePDFMessage} from '../conversation/attachment-actions'
import {useConversationMessage} from '../conversation/data-hooks'

const ChatPDF = (props: Props) => {
  const {messageID} = props
  const conversationIDKey = props.conversationIDKey ?? T.Chat.noConversationIDKey
  const [initialMessage] = React.useState(() =>
    isMobile ? undefined : takePDFMessage(conversationIDKey, messageID)
  )
  const [error, setError] = React.useState('')
  const loadedMessage = useConversationMessage(conversationIDKey, messageID)
  const message = loadedMessage?.type === 'attachment' ? loadedMessage : initialMessage
  const title = message?.title || message?.fileName || 'PDF'
  const url = props.url ?? message?.fileURL
  const navigation = useNavigation()

  React.useEffect(() => {
    if (isMobile) return
    navigation.setOptions({title})
  }, [navigation, title])

  if (!isMobile) {
    const canDownload = !!message
    const onDownload = () => {
      if (message) {
        attachmentDownloadMessage(conversationIDKey, message)
      }
      openLocalPathInSystemFileManagerDesktop(C.downloadFolder)
    }

    return (
      <>
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
          <embed src={url} width="100%" height="100%" />
        </Kb.Box2>
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          fullWidth={true}
          style={desktopStyles.modalFooter}
        >
          <Kb.ButtonBar small={true}>
            <Kb.Button type="Default" label="Download" onClick={onDownload} disabled={!canDownload} />
          </Kb.ButtonBar>
        </Kb.Box2>
      </>
    )
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      {url && !error ? (
        <Kb.WebView
          originWhitelist={['*']}
          renderLoading={() => (
            <Kb.Box2
              direction="vertical"
              justifyContent="center"
              style={nativeStyles.progressContainer}
              fullWidth={true}
              fullHeight={true}
            >
              <Kb.ProgressIndicator white={true} />
            </Kb.Box2>
          )}
          url={url}
          pinnedURLMode={true}
          onError={err => setError(err)}
          style={nativeStyles.webViewContainer}
        />
      ) : (
        <Kb.Text type="BodySmallError">Can&apos;t load this file {error}</Kb.Text>
      )}
    </Kb.Box2>
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(() => ({
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
}))

const nativeStyles = Kb.Styles.styleSheetCreate(() => ({
  progressContainer: {position: 'absolute'},
  webViewContainer: {margin: Kb.Styles.globalMargins.xtiny},
}))

export default ChatPDF
