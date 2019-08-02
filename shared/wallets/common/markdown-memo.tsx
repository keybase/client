import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {StyleOverride} from '../../common-adapters/markdown'
import {isMobile} from '../../constants/platform'

const styleOverride = Styles.styleSheetCreate({
  del: {
    color: Styles.globalColors.black,
  },
  em: {
    color: Styles.globalColors.black,
  },
  link: {
    color: Styles.globalColors.black,
  },
  paragraph: {
    color: Styles.globalColors.black,
  },
  strong: {
    color: Styles.globalColors.black,
  },
})

type Props = {
  memo: string
  hideDivider?: boolean
  style?: Styles.StylesCrossPlatform
  styleOverride?: StyleOverride
}

const MarkdownMemo = (props: Props) =>
  props.memo ? (
    <Kb.Box2
      direction="horizontal"
      gap="small"
      fullWidth={true}
      style={Styles.collapseStyles([props.style, styles.container])}
    >
      {!props.hideDivider && <Kb.Divider vertical={true} style={styles.quoteMarker} />}
      <Kb.Markdown
        style={styles.memo}
        styleOverride={Styles.collapseStyles([isMobile ? styleOverride : undefined, props.styleOverride])}
        allowFontScaling={true}
      >
        {props.memo}
      </Kb.Markdown>
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate({
  container: {
    marginBottom: Styles.globalMargins.xxtiny,
    marginTop: Styles.globalMargins.xxtiny,
    maxWidth: '100%',
  },
  memo: Styles.platformStyles({
    // Taken from text message styling
    common: {
      maxWidth: '100%',
      width: '100%',
    },
    isElectron: {
      cursor: 'text',
      userSelect: 'text',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    },
  }),
  quoteMarker: {maxWidth: 3, minWidth: 3},
})

export default MarkdownMemo
