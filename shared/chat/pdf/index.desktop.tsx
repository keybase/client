import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useNavigation} from '@react-navigation/native'
import type {Props} from './index.shared'
import * as T from '@/constants/types'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
import {attachmentDownloadMessage, takePDFMessage} from '../conversation/attachment-actions'
import {useConversationMessage} from '../conversation/data-hooks'

const ChatPDF = (props: Props) => {
  const {messageID} = props
  const conversationIDKey = props.conversationIDKey ?? T.Chat.noConversationIDKey
  const [initialMessage] = React.useState(() => takePDFMessage(conversationIDKey, messageID))
  const loadedMessage = useConversationMessage(conversationIDKey, messageID)
  const message = loadedMessage?.type === 'attachment' ? loadedMessage : initialMessage
  const title = message?.title || message?.fileName || 'PDF'
  const url = props.url ?? message?.fileURL
  const navigation = useNavigation()
  const canDownload = !!message

  const onDownload = () => {
    if (message) {
      attachmentDownloadMessage(conversationIDKey, message)
    }
    openLocalPathInSystemFileManagerDesktop(C.downloadFolder)
  }

  React.useEffect(() => {
    navigation.setOptions({title})
  }, [navigation, title])

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <embed src={url} width="100%" height="100%" />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
        <Kb.ButtonBar small={true}>
          <Kb.Button type="Default" label="Download" onClick={onDownload} disabled={!canDownload} />
        </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
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

export default ChatPDF
