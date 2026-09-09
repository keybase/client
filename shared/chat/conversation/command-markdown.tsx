import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as InputState from './input-area/input-state'
import {ComposerBoxContext} from './composer-viewport-context'

const CommandMarkdown = () => {
  const styles = useStyles()
  const md = InputState.useConversationInput(s => s.commandMarkdown)
  const body = md?.body ?? ''
  const title = md?.title ?? undefined
  // a percentage maxHeight has no definite-height ancestor here, so yoga re-resolves it at
  // every nesting level and each box ends up taller than its content: the leftover slack shows
  // as a gap between the input's buttons and the keyboard. clamp in points instead.
  const {commandMarkdownMaxHeight} = React.useContext(ComposerBoxContext)
  const maxHeightStyle = isMobile ? {maxHeight: commandMarkdownMaxHeight} : undefined
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([styles.container, maxHeightStyle])}
    >
      {!!title && (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.title}>
          <Kb.Markdown>{title}</Kb.Markdown>
        </Kb.Box2>
      )}
      <Kb.ScrollView style={styles.scrollContainer}>
        <Kb.Box2 direction="vertical" style={styles.bodyContainer}>
          <Kb.Markdown selectable={true}>{body}</Kb.Markdown>
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      bodyContainer: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
      },
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          border: `1px solid ${theme.black_20}`,
          borderRadius: Kb.Styles.borderRadius,
          marginBottom: Kb.Styles.globalMargins.xtiny,
          ...Kb.Styles.marginH(Kb.Styles.globalMargins.small),
        },
        isMobile: {
          backgroundColor: theme.white,
          flexShrink: 1,
          // constrained in points by the caller (percentages cascade badly here); without any
          // constraint this pushes the rest of the input down
        },
      }),
      scrollContainer: Kb.Styles.platformStyles({
        isElectron: {maxHeight: 300},
      }),
      title: {
        backgroundColor: theme.black_05,
        ...Kb.Styles.bottomDivider(theme),
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
      },
    }) as const
)

export default CommandMarkdown
