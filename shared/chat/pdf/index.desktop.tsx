import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'
import {useFSState} from '@/stores/fs'

const ChatPDF = (props: Props) => {
  const {ordinal} = props
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))
  const title = message?.title || message?.fileName || 'PDF'
  const url = message?.fileURL
  const openLocalPathInSystemFileManagerDesktop = useFSState(
    s => s.dispatch.defer.openLocalPathInSystemFileManagerDesktop
  )

  const attachmentDownload = Chat.useChatContext(s => s.dispatch.attachmentDownload)
  const onDownload = React.useCallback(() => {
    message && attachmentDownload(message.ordinal)
    openLocalPathInSystemFileManagerDesktop?.(C.downloadFolder)
  }, [openLocalPathInSystemFileManagerDesktop, attachmentDownload, message])
  return (
    <Kb.Modal2
      header={{
        title: <Kb.Text type="BodyBig">{title}</Kb.Text>,
      }}
      footer={{
        content: (
          <Kb.ButtonBar small={true}>
            <Kb.Button type="Default" label="Download" onClick={onDownload} />
          </Kb.ButtonBar>
        ),
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <embed src={url} width="100%" height="100%" />
      </Kb.Box2>
    </Kb.Modal2>
  )
}

export default ChatPDF
