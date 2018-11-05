// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isMobile} from '../../constants/platform'

type Props = {
  memo: string,
  style?: Styles.StylesCrossPlatform,
}

const MarkdownMemo = (props: Props) =>
  props.memo ? (
    <Kb.Box2 direction="horizontal" gap="small" fullWidth={true} style={props.style}>
      <Kb.Divider vertical={true} style={styles.quoteMarker} />
      <Kb.Markdown
        style={styles.memo}
        styleOverride={isMobile ? styleOverride : undefined}
        allowFontScaling={true}
      >
        {props.memo}
      </Kb.Markdown>
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate({
  container: {
    maxWidth: '100%',
  },
  memo: Styles.platformStyles({
    // Taken from text message styling
    common: {
      width: '100%',
      maxWidth: '100%',
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

const styleOverride = Styles.styleSheetCreate({
  paragraph: {
    color: Styles.globalColors.black_75,
  },
  strong: {
    color: Styles.globalColors.black_75,
  },
  em: {
    color: Styles.globalColors.black_75,
  },
  del: {
    color: Styles.globalColors.black_75,
  },
  link: {
    color: Styles.globalColors.black_75,
  },
})

export default MarkdownMemo
