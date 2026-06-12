import * as Kb from '@/common-adapters'

const NoConversation = () => (
  <Kb.EmptyState
    gap="xsmall"
    illustration="icon-fancy-encrypted-computer-desktop-150-72"
    style={styles.container}
    text="All conversations are end-to-end encrypted."
    textType="BodySmall"
  />
)

const styles = Kb.Styles.styleSheetCreate(() => ({container: {flex: 1}}) as const)

export default NoConversation
