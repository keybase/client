import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const NoConversation = ({onBack}: {onBack: () => void}) => (
  <Kb.HeaderHocWrapper onBack={onBack}>
    <Kb.Box2 direction="vertical" gap="xsmall" centerChildren={true} style={styles.noConvoText}>
      <Kb.Icon type="icon-fancy-encrypted-computer-desktop-150-72" />
      <Kb.Text type="BodySmall">All conversations are end-to-end encrypted.</Kb.Text>
    </Kb.Box2>
  </Kb.HeaderHocWrapper>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      noConvoText: {
        alignSelf: 'center',
        flex: 1,
        justifyContent: 'center',
      },
    } as const)
)

export default NoConversation
