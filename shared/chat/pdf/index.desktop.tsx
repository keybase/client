import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {Props} from '.'
import {useFSState} from '@/stores/fs'
import {useModalHeaderState} from '@/stores/modal-header'

const ChatPDF = (props: Props) => {
  const {ordinal} = props
  const message = ConvoState.useChatContext(s => s.messageMap.get(ordinal))
  const title = message?.title || message?.fileName || 'PDF'
  const url = message?.fileURL
  const openLocalPathInSystemFileManagerDesktop = useFSState(
    s => s.dispatch.openLocalPathInSystemFileManagerDesktop
  )

  const attachmentDownload = ConvoState.useChatContext(s => s.dispatch.attachmentDownload)
  const onDownload = () => {
    message && attachmentDownload(message.ordinal)
    openLocalPathInSystemFileManagerDesktop?.(C.downloadFolder)
  }

  React.useEffect(() => {
    useModalHeaderState.setState({title})
    return () => {
      useModalHeaderState.setState({title: ''})
    }
  }, [title])

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <embed src={url} width="100%" height="100%" />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
          <Kb.ButtonBar small={true}>
            <Kb.Button type="Default" label="Download" onClick={onDownload} />
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
