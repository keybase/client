import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import {downloadFolder} from '../../constants/platform'
import type {Props} from '.'

const ChatPDF = (props: Props) => {
  const {message} = props
  const title = message?.title || message?.fileName || 'PDF'
  const url = message?.fileURL
  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )

  const attachmentDownload = C.useChatContext(s => s.dispatch.attachmentDownload)
  const onDownload = React.useCallback(() => {
    message && attachmentDownload(message.id)
    openLocalPathInSystemFileManagerDesktop?.(downloadFolder)
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
