import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {Props} from './text-view'

const TextView = (props: Props) => {
  const {url} = props
  const [content, setContent] = React.useState('')
  React.useEffect(() => {
    const req = SafeElectron.getRemote().net.request({method: 'GET', url})
    req.on('response', response => response.on('data', data => setContent(content => content + data)))
    req.end()
  }, [url])
  return (
    <Kb.Box2 fullWidth={true} fullHeight={true} direction="vertical" style={styles.container}>
      <Kb.Box2 style={styles.innerContainer} direction="horizontal" alignItems="flex-start">
        <Kb.Text type="Terminal" selectable={true} style={styles.text}>
          {content}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.blueLighter3,
    overflow: 'scroll',
    padding: Styles.globalMargins.medium,
  },
  innerContainer: {
    ...Styles.globalStyles.flexGrow,
    backgroundColor: Styles.globalColors.white,
    color: Styles.globalColors.black,
    maxWidth: '100%',
    paddingBottom: Styles.globalMargins.large,
    paddingLeft: Styles.globalMargins.xlarge,
    paddingRight: Styles.globalMargins.xlarge,
    paddingTop: Styles.globalMargins.large,
    width: 680,
  },
  text: {
    color: Styles.globalColors.black_on_white,
    whiteSpace: 'pre',
  },
})

export default TextView
