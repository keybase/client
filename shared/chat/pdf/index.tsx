import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {PdfEmbed} from '@/common-adapters/pdf-embed'
import * as React from 'react'
import * as T from '@/constants/types'
import {useNavigation} from '@react-navigation/native'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
import {
  attachmentDownloadMessage,
  messageAttachmentAndroidDownloadMessage,
  messageAttachmentNativeShareMessage,
  takePDFMessage,
} from '../conversation/attachment-actions'
import {useConversationMessage} from '../conversation/data-hooks'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

type Props = {
  conversationIDKey?: T.Chat.ConversationIDKey
  messageID: T.Chat.MessageID
  url?: string
}

const ChatPDF = (props: Props) => {
  const nativeStyles = useNativeStyles()
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
      <Kb.ModalScreen
        scroll={false}
        padding="none"
        footer={<Kb.Button type="Default" label="Download" onClick={onDownload} disabled={!canDownload} />}
      >
        <PdfEmbed url={url} testID={TestIDs.CHAT_PDF_VIEWER} />
      </Kb.ModalScreen>
    )
  }

  // Android's WebView can't display a PDF, so the screen offers the file to another app, or to Downloads
  if (isAndroid) {
    return (
      <Kb.ModalScreen scroll={false} padding="none">
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          centerChildren={true}
          gap="small"
          style={nativeStyles.noPreview}
          testID={TestIDs.CHAT_PDF_VIEWER}
        >
          <Kb.ImageIcon type="icon-file-64" />
          <Kb.Text type="BodySemibold" center={true}>
            {title}
          </Kb.Text>
          <Kb.Text type="BodySmall" center={true}>
            This PDF can&apos;t be opened here. Share it to open it in another app, or download it.
          </Kb.Text>
          <Kb.ButtonBar direction="column" fullWidth={true}>
            <Kb.Button
              label="Share"
              fullWidth={true}
              disabled={!message}
              onClick={() => message && messageAttachmentNativeShareMessage(conversationIDKey, message)}
            />
            <Kb.Button
              label="Download"
              mode="Secondary"
              fullWidth={true}
              disabled={!message}
              onClick={() => message && messageAttachmentAndroidDownloadMessage(conversationIDKey, message)}
            />
          </Kb.ButtonBar>
        </Kb.Box2>
      </Kb.ModalScreen>
    )
  }

  return (
    <Kb.ModalScreen scroll={false} padding="none">
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
          testID={TestIDs.CHAT_PDF_VIEWER}
        />
      ) : (
        <Kb.Text type="BodySmallError">Can&apos;t load this file {error}</Kb.Text>
      )}
    </Kb.ModalScreen>
  )
}

const useNativeStyles = Kb.Styles.createStyleHook(() => ({
  noPreview: Kb.Styles.padding(Kb.Styles.globalMargins.large),
  progressContainer: {position: 'absolute'},
  webViewContainer: {margin: Kb.Styles.globalMargins.xtiny},
}))

export default ChatPDF
