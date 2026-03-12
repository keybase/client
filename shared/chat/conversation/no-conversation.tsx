import * as Kb from '@/common-adapters'

const NoConversation = () => (
  <Kb.Box2 direction="vertical" gap="xsmall" centerChildren={true} flex={1} style={styles.noConvoText}>
    <Kb.ImageIcon type="icon-fancy-encrypted-computer-desktop-150-72" />
    <Kb.Text type="BodySmall">All conversations are end-to-end encrypted.</Kb.Text>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      noConvoText: {
        alignSelf: 'center',
        justifyContent: 'center',
      },
    }) as const
)

export default NoConversation
