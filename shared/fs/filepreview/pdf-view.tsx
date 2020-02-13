import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Platform from '../../constants/platform'

type Props = {
  url: string
  onUrlError?: (err: string) => void
}

const PdfView = (props: Props) => (
  <Kb.Box2 fullHeight={true} fullWidth={true} direction="vertical">
    <Kb.WebView
      url={props.url}
      pinnedURLMode={true}
      style={styles.webview}
      onError={props.onUrlError}
      renderLoading={() => (
        <Kb.Box2 direction="vertical" style={styles.progressContainer} fullWidth={true} fullHeight={true}>
          <Kb.ProgressIndicator white={true} />
        </Kb.Box2>
      )}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      progressContainer: {
        justifyContent: 'center',
        position: 'absolute',
      },
      webview: {
        height: '100%',
        width: '100%',
      },
    } as const)
)

// Only supported on iOS for now.
export default Platform.isIOS ? PdfView : () => null
