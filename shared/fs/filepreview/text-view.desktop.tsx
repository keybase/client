import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {Props} from './text-view'

const TextView = (props: Props) => {
  const {url} = props
  const [content, setContent] = React.useState('')
  React.useEffect(() => {
    const req = new XMLHttpRequest()
    req.onreadystatechange = () => {
      try {
        if (req.readyState === XMLHttpRequest.DONE && req.status === 200) {
          setContent(req.responseText)
        }
      } catch (e) {}
    }
    try {
      req.open('GET', url)
      req.send()
    } catch (e) {}
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
    whiteSpace: 'pre-wrap',
  },
})

export default TextView
