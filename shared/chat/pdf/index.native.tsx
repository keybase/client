import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ConfigGen from '../../actions/config-gen'
import {Props} from '.'
import useFixStatusbar from '../../common-adapters/use-fix-statusbar.native'

const ChatPDF = (props: Props) => {
  const url = Container.getRouteProps(props, 'url', '')
  const title = Container.getRouteProps(props, 'title', 'PDF')
  const [error, setError] = React.useState('')

  useFixStatusbar()

  const dispatch = Container.useDispatch()
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
  const onShare = () =>
    dispatch(ConfigGen.createShowShareActionSheet({filePath: url, mimeType: 'application/pdf'}))
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
  webViewContainer: {
    margin: Styles.globalMargins.xtiny,
  },
}))

export default ChatPDF
