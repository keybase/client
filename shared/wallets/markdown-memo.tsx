import * as Kb from '@/common-adapters'
import type {StyleOverride} from '@/common-adapters/markdown'

const useStyleOverride = Kb.Styles.createStyleHook(theme => ({
  del: {
    color: theme.black,
  },
  em: {
    color: theme.black,
  },
  link: {
    color: theme.black,
  },
  paragraph: {
    color: theme.black,
  },
  strong: {
    color: theme.black,
  },
}))

type Props = {
  memo: string
  hideDivider?: boolean
  style?: Kb.Styles.StylesCrossPlatform
  styleOverride?: StyleOverride
}

const MarkdownMemo = (props: Props) =>
  {
    const styleOverride = useStyleOverride()
  const styles = useStyles()
  return props.memo ? (
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
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  container: {
    ...Kb.Styles.marginV(Kb.Styles.globalMargins.xxtiny),
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
