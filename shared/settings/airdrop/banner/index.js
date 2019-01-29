// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {|
  onCheckQualify: () => void,
  onCancel: () => void,
|}

const Banner = (p: Props) => (
  <Kb.Box2 noShrink={true} direction="vertical" style={styles.container}>
    <Kb.Icon type="icon-stellar-coins-flying-2-48" style={styles.star} />
    <Kb.Text center={true} type="Header" style={styles.headerText}>
      You are qualified to join!
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.purple2,
    flexGrow: 1,
    height: 40,
  },
})

export default Banner
