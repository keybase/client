import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'

const CommandMarkdown = () => {
  const md = Chat.useChatContext(s => s.commandMarkdown)
  const body = md?.body ?? ''
  const title = md?.title ?? undefined
  return (
    <Kb.Box style={styles.container}>
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
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bodyContainer: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.xsmall,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          border: `1px solid ${Kb.Styles.globalColors.black_20}`,
          borderRadius: Kb.Styles.borderRadius,
          marginBottom: Kb.Styles.globalMargins.xtiny,
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
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
        borderBottomWidth: 1,
        borderColor: Kb.Styles.globalColors.black_10,
        borderStyle: 'solid',
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.xsmall,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default CommandMarkdown
