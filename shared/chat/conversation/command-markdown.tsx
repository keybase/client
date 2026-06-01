import * as Kb from '@/common-adapters'
import * as InputState from './input-area/input-state'

const CommandMarkdown = () => {
  const md = InputState.useConversationInput(s => s.commandMarkdown)
  const body = md?.body ?? ''
  const title = md?.title ?? undefined
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bodyContainer: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
      },
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          border: `1px solid ${Kb.Styles.globalColors.black_20}`,
          borderRadius: Kb.Styles.borderRadius,
          marginBottom: Kb.Styles.globalMargins.xtiny,
          ...Kb.Styles.marginH(Kb.Styles.globalMargins.small),
        },
        isMobile: {
          backgroundColor: Kb.Styles.globalColors.white,
          flexShrink: 1,
          // if this is not constrained it pushes the rest of the input down
          maxHeight: '70%',
        },
      }),
      scrollContainer: Kb.Styles.platformStyles({
        isElectron: {maxHeight: 300},
      }),
      title: {
        backgroundColor: Kb.Styles.globalColors.black_05,
        ...Kb.Styles.bottomDivider(),
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
      },
    }) as const
)

export default CommandMarkdown
