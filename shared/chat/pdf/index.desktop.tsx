import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as FSConstants from '../../constants/fs'
import * as Chat2Gen from '../../actions/chat2-gen'
import {downloadFolder} from '../../constants/platform'
import type {Props} from '.'

const ChatPDF = (props: Props) => {
  const {message} = props
  const title = message?.title || message?.fileName || 'PDF'
  const url = message?.fileURL
  const dispatch = Container.useDispatch()
  const openLocalPathInSystemFileManagerDesktop = FSConstants.useState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const onDownload = React.useCallback(() => {
    message &&
      dispatch(
        Chat2Gen.createAttachmentDownload({
          conversationIDKey: message.conversationIDKey,
          ordinal: message.id,
        })
      )
    openLocalPathInSystemFileManagerDesktop?.(downloadFolder)
  }, [openLocalPathInSystemFileManagerDesktop, dispatch, message])
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
