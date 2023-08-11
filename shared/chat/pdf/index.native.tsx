import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as ConfigConstants from '../../constants/config'
import * as C from '../../constants'
import type {Props} from '.'

const ChatPDF = (props: Props) => {
  const {message, url} = props
  const title = message?.title || message?.fileName || 'PDF'
  const [error, setError] = React.useState('')
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => navigateUp()
  const showShareActionSheet = ConfigConstants.useConfigState(s => s.dispatch.dynamic.showShareActionSheet)
  const onShare = () => showShareActionSheet?.(url ?? '', '', 'application/pdf')
  const rightActions = [{icon: 'iconfont-share', onPress: onShare} as const]
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.HeaderHocHeader title={title} onBack={onBack} rightActions={rightActions} />
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
        <Kb.Text type="BodySmallError">Can't load this file {error}</Kb.Text>
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  progressContainer: {
    justifyContent: 'center',
    position: 'absolute',
  },
  webViewContainer: {margin: Styles.globalMargins.xtiny},
}))

export default ChatPDF
