import * as Kb from '@/common-adapters'
import type {StyleOverride} from '@/common-adapters/markdown'

const styleOverride: StyleOverride = Kb.Styles.styleSheetCreate(() => ({
  del: {
    color: Kb.Styles.globalColors.black,
  },
  em: {
    color: Kb.Styles.globalColors.black,
  },
  link: {
    color: Kb.Styles.globalColors.black,
  },
  paragraph: {
    color: Kb.Styles.globalColors.black,
  },
  strong: {
    color: Kb.Styles.globalColors.black,
  },
}))

type Props = {
  memo: string
  hideDivider?: boolean
  style?: Kb.Styles.StylesCrossPlatform
  styleOverride?: StyleOverride
}

const MarkdownMemo = (props: Props) =>
  props.memo ? (
    <Kb.Box2
      direction="horizontal"
      gap="small"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([props.style, styles.container])}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    marginBottom: Kb.Styles.globalMargins.xxtiny,
    marginTop: Kb.Styles.globalMargins.xxtiny,
    maxWidth: '100%',
  },
  memo: Kb.Styles.platformStyles({
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
      ...Kb.Styles.globalStyles.flexBoxColumn,
    },
  }),
  quoteMarker: {maxWidth: 3, minWidth: 3},
}))

export default MarkdownMemo
