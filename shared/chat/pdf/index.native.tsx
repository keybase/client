import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {Props} from '.'

const ChatPDF = (props: Props) => {
  const url = Container.getRouteProps(props, 'url', '')
  const title = Container.getRouteProps(props, 'title', 'PDF')
  const dispatch = Container.useDispatch()
  const [error, setError] = React.useState(null)
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.HeaderHocHeader title={title} onBack={onBack} />
      {url && !error ? (
        <Kb.WebView
          allowFileAccess={true}
          renderLoading={() => (
            <Kb.Box2 direction="vertical" style={styles.progressContainer} fullWidth={true} fullHeight={true}>
              <Kb.ProgressIndicator white={true} />
            </Kb.Box2>
          )}
          url={url}
          onError={err => setError(err)}
          style={styles.webViewContainer}
        />
      ) : (
        <Kb.Text type="Error">Can't load this file {error}</Kb.Text>
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
    margin: 10,
  },
}))

export default ChatPDF
