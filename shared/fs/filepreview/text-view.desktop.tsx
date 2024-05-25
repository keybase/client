import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from './text-view'

const TextView = (props: Props) => {
  const {onUrlError, url} = props
  const [content, setContent] = React.useState('')
  React.useEffect(() => {
    const req = new XMLHttpRequest()
    req.onreadystatechange = () => {
      try {
        if (req.readyState === XMLHttpRequest.DONE && req.status === 200) {
          setContent(req.responseText)
        }
      } catch {
        onUrlError && onUrlError('http request failed')
      }
    }
    try {
      req.open('GET', url)
      req.send()
    } catch {}
  }, [onUrlError, url])
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueLighter3,
          padding: Kb.Styles.globalMargins.medium,
        },
        isElectron: {overflow: 'scroll'} as const,
      }),
      innerContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
        backgroundColor: Kb.Styles.globalColors.white,
        color: Kb.Styles.globalColors.black,
        maxWidth: '100%',
        paddingBottom: Kb.Styles.globalMargins.large,
        paddingLeft: Kb.Styles.globalMargins.xlarge,
        paddingRight: Kb.Styles.globalMargins.xlarge,
        paddingTop: Kb.Styles.globalMargins.large,
        width: 800,
      },
      text: Kb.Styles.platformStyles({
        isElectron: {
          color: Kb.Styles.globalColors.black_on_white,
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
        },
      }),
    }) as const
)

export default TextView
