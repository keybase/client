import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {}

const NewCard = (_: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container}>
    <Kb.Box2 direction="vertical">
      <Kb.Text type="BodySemibold">This conversation is end-to-end encrypted.</Kb.Text>
      <Kb.Text type="BodyPrimaryLink">Read more ></Kb.Text>
    </Kb.Box2>
    <Kb.Icon type="icon-illustration-encrypted-116-96" />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Styles.globalColors.blueDark,
    maxHeight: Styles.isMobile ? undefined : 100,
    maxWidth: Styles.isMobile ? '80%' : 400,
    padding: Styles.padding(
      Styles.globalMargins.medium,
      Styles.globalMargins.medium,
      Styles.isMobile ? Styles.globalMargins.medium : 0
    ),
  },
}))

export default NewCard
