// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {memoize} from '../../util/memoize'

type Props = {
  url: string,
  onLoadingStateChange?: (isLoading: boolean) => void,
}

export default (Styles.isMobile
  ? (props: Props) => (
      <Kb.WebView styles={styles.webview} url={props.url} onLoadingStateChange={props.onLoadingStateChange} />
    )
  : (props: Props) => (
      <Kb.Box2
        direction="vertical"
        fullHeight={true}
        fullWidth={true}
        centerChildren={true}
        style={styles.containerDesktop}
      >
        <Kb.WebView
          style={styles.webview}
          url="about:blank"
          injections={desktopInjections(props.url)}
          onLoadingStateChange={props.onLoadingStateChange}
        />
      </Kb.Box2>
    ))

const styles = Styles.styleSheetCreate({
  containerDesktop: {
    flex: 1,
    marginBottom: Styles.globalMargins.medium,
    marginTop: Styles.globalMargins.medium,
  },
  webview: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexGrow,
      width: '100%',
    },
    isMobile: {
      backgroundColor: Styles.globalColors.blue5,
    },
  }),
})

// We are inserting dom manually rather than simply loading the video directly
// to 1) have finer control on the <video> tag, so we can do stuff like
// disabling controls; 2) not rely on webview to detect the video source. For
// example, it may not show a .mov, but prompts user to download it.
const desktopCSS = `
html {
  display: block;
  margin: 0;
  padding: 0;
}
body {
  display: block;
  margin: 0;
  padding: 0;
}
video {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  margin: auto;
  object-fit: contain;
  max-height: 100%;
  max-width: 100%;
}
`

// Double quote around ${url} is necessary as encodeURIComponent encodes double
// quote but not single quote.
const desktopJavaScript = url => `
const v = document.createElement("video")
v.setAttribute('loop', true)
v.setAttribute('controls', true)
v.setAttribute('controlsList', 'nodownload nofullscreen')
v.setAttribute('src', "${url}")
document.getElementsByTagName('body')[0].appendChild(v)
v.play()
`

const desktopInjections = memoize(url => ({
  css: desktopCSS,
  javaScript: desktopJavaScript(url),
}))
