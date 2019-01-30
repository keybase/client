// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {|
  onCheckQualify: () => void,
  onCancel: () => void,
  show: boolean,
|}

const Banner = (p: Props) =>
  p.show ? (
    <Kb.Box2 noShrink={true} fullWidth={true} direction="horizontal" style={styles.container}>
      <Kb.Icon type="icon-stellar-coins-flying-2-48" />
      <Kb.Text backgroundMode="Terminal" center={true} type="Header" style={styles.headerText}>
        Get free Lumens every month
      </Kb.Text>
      <Kb.Button type="Primary" label="See if you qualify" onClick={p.onCheckQualify} />
      <Kb.Icon type="iconfont-close" onClick={p.onCancel} style={styles.close} />
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate({
  close: {padding: Styles.globalMargins.tiny},
  container: {
    backgroundColor: Styles.globalColors.purple2,
    height: 40,
  },
  headerText: {flexGrow: 1},
})

export default Banner
