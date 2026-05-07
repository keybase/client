import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'

const ChatPDF = (props: Props) => {
  const {url} = props
  const [error, setError] = React.useState('')
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      {url && !error ? (
        <Kb.WebView
          originWhitelist={['*']}
          renderLoading={() => (
            <Kb.Box2 direction="vertical" justifyContent="center" style={styles.progressContainer} fullWidth={true} fullHeight={true}>
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
    position: 'absolute',
  },
  webViewContainer: {margin: Kb.Styles.globalMargins.xtiny},
}))

export default ChatPDF
