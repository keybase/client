import * as React from 'react'
import {Box2, Icon, Text} from '../../common-adapters'
import * as Styles from '../../styles'

const NoConversation = () => (
  <Box2 direction="vertical" gap="xsmall" centerChildren={true} style={styles.noConvoText}>
    <Icon type="icon-fancy-encrypted-computer-desktop-150-72" />
    <Text type="BodySmall">All conversations are end-to-end encrypted.</Text>
  </Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  noConvoText: {
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'center',
  },
} as const))

export default NoConversation
