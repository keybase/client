import * as React from 'react'
import * as Kb from '@/common-adapters'
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
  const {onUrlError, url} = props

  const [content, setContent] = React.useState('')
  React.useEffect(() => {
    if (isMobile) return
    fetchContent(url, setContent, onUrlError)
  }, [onUrlError, url])

  if (!isMobile) {
    return (
      <Kb.Box2 fullWidth={true} fullHeight={true} direction="vertical" padding="small" style={styles.container}>
        <Kb.Box2 style={styles.innerContainer} direction="horizontal" alignItems="flex-start">
          <Kb.Text type="Terminal" selectable={true} style={styles.text}>
            {content}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 fullHeight={true} fullWidth={true} direction="vertical">
      <Kb.WebView
        url={url}
        pinnedURLMode={true}
        style={styles.webview}
        injections={injections}
        onError={onUrlError}
        showLoadingStateUntilLoaded={true}
      />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueLighter3,
        },
        isElectron: {overflow: 'auto', scrollbarGutter: 'stable'} as const,
      }),
      innerContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
        backgroundColor: Kb.Styles.globalColors.white,
        color: Kb.Styles.globalColors.black,
        maxWidth: '100%',
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
        width: 800,
      },
      text: Kb.Styles.platformStyles({
        isElectron: {
          color: Kb.Styles.globalColors.black_on_white,
          overflow: 'auto',
          whiteSpace: 'pre',
        },
      }),
      webview: {
        backgroundColor: Kb.Styles.globalColors.white,
        height: '100%',
        width: '100%',
      },
    }) as const
)

const webviewCSS = `
html{
  background-color: ${colors.blueLighter3};
  padding-top: ${Kb.Styles.globalMargins.mediumLarge};
  padding-bottom: ${Kb.Styles.globalMargins.mediumLarge};
  margin: 0;
}
body{
  background-color: ${colors.white};
  padding: ${Kb.Styles.globalMargins.medium};
  margin: 0;
  color: ${colors.black};
  font-size: 15;
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
