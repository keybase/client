import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'
import {useConfigState} from '@/stores/config'

const ChatPDF = (props: Props) => {
  const {ordinal, url} = props
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))
  const title = message?.title || message?.fileName || 'PDF'
  const [error, setError] = React.useState('')
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => navigateUp()
  const showShareActionSheet = useConfigState(s => s.dispatch.defer.showShareActionSheet)
  const onShare = () => {
    showShareActionSheet?.(url ?? '', '', 'application/pdf')
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.HeaderHocHeader
        title={title}
        onBack={onBack}
        rightActionIcon="iconfont-share"
        onRightAction={onShare}
      />
      {url && !error ? (
        <Kb.WebView
          originWhitelist={['*']}
          renderLoading={() => (
            <Kb.Box2 direction="vertical" style={styles.progressContainer} fullWidth={true} fullHeight={true}>
              <Kb.ProgressIndicator white={true} />
            </Kb.Box2>
          )}
          url={url}
          pinnedURLMode={true}
          onError={err => setError(err)}
          style={styles.webViewContainer}
        />
      ) : (
        <Kb.Text type="BodySmallError">Can&apos;t load this file {error}</Kb.Text>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  progressContainer: {
    justifyContent: 'center',
    position: 'absolute',
  },
  webViewContainer: {margin: Kb.Styles.globalMargins.xtiny},
}))

export default ChatPDF
