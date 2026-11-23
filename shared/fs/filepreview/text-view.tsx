import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {colors, darkColors} from '@/styles/colors'

type Props = {
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
  onUrlError?: (err: string) => void
}

const fetchContent = (
  url: string,
  setContent: (content: string) => void,
  onUrlError?: (err: string) => void
) => {
  const req = new XMLHttpRequest()
  req.onreadystatechange = () => {
    try {
      if (req.readyState === XMLHttpRequest.DONE && req.status === 200) {
        setContent(req.responseText)
      }
    } catch {
      onUrlError?.('http request failed')
    }
  }
  try {
    req.open('GET', url)
    req.send()
  } catch {}
}

const TextView = (props: Props) => {
  const styles = useStyles()
  const {onUrlError, url} = props
  // the page's own margins sit inside the screen's side strips (iPhone Duo), not under them
  const {left, right} = Kb.useScreenSideInsets()

  const [content, setContent] = React.useState('')
  React.useEffect(() => {
    if (isMobile) return
    fetchContent(url, setContent, onUrlError)
  }, [onUrlError, url])

  if (!isMobile) {
    return (
      <Kb.Box2 fullWidth={true} fullHeight={true} direction="vertical" padding="small" style={styles.container}>
        <Kb.Box2
          alignSelf="center"
          style={styles.innerContainer}
          direction="horizontal"
          alignItems="flex-start"
          testID={content ? TestIDs.FILES_TEXT_PREVIEW : undefined}
        >
          <Kb.Text type="Terminal" selectable={true} style={styles.text}>
            {content}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2
      fullHeight={true}
      fullWidth={true}
      direction="vertical"
      style={Kb.Styles.collapseStyles([styles.container, {paddingLeft: left, paddingRight: right}])}
    >
      <Kb.WebView
        url={url}
        pinnedURLMode={true}
        style={styles.webview}
        injections={injections}
        onError={onUrlError}
        showLoadingStateUntilLoaded={true}
        testID={TestIDs.FILES_TEXT_PREVIEW}
      />
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: Kb.Styles.platformStyles({
        common: {
          backgroundColor: theme.blueLighter3,
        },
        isElectron: {overflow: 'auto', scrollbarGutter: 'stable'} as const,
      }),
      innerContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
        backgroundColor: theme.white,
        color: theme.black,
        maxWidth: '100%',
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
        width: 800,
      },
      text: Kb.Styles.platformStyles({
        isElectron: {
          color: theme.black_on_white,
          overflow: 'auto',
          whiteSpace: 'pre',
        },
      }),
      webview: {
        backgroundColor: theme.white,
        height: '100%',
        width: '100%',
      },
    }) as const
)

const webviewCSS = `
html{
  background-color: ${colors.blueLighter3};
  padding-top: ${Kb.Styles.globalMargins.mediumLarge}px;
  padding-bottom: ${Kb.Styles.globalMargins.mediumLarge}px;
  margin: 0;
}
body{
  background-color: ${colors.white};
  padding: ${Kb.Styles.globalMargins.medium}px;
  margin: 0;
  color: ${colors.black};
  font-size: 15px;
  line-height: 1.6;
}
@media (prefers-color-scheme: dark) {
  html{
    background-color: ${darkColors.blueLighter3};
  }
  body{
    background-color: ${darkColors.white};
    color: ${darkColors.black};
  }
}
pre{
  font-family: "${Kb.Styles.globalStyles.fontTerminal.fontFamily}", monospace;
}
`

const injections = {
  css: webviewCSS,
}

export default TextView
