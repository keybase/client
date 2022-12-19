import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type {StyleOverride} from '../../common-adapters/markdown'

const styleOverride: StyleOverride = Styles.styleSheetCreate(() => ({
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
}))

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
      <Kb.Text type="Body" style={styles.memo}>
        <Kb.Markdown
          style={styles.memo}
          styleOverride={{...styleOverride, ...props.styleOverride}}
          allowFontScaling={true}
        >
          {props.memo}
        </Kb.Markdown>
      </Kb.Text>
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate(() => ({
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
    } as const,
    isMobile: {
      ...Styles.globalStyles.flexBoxColumn,
    },
  }),
  quoteMarker: {maxWidth: 3, minWidth: 3},
}))

export default MarkdownMemo
