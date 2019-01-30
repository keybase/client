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
      <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.starContainer}>
        <Kb.Icon type="icon-stellar-coins-flying-2-48" />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" style={styles.textContainer} gap="tiny">
        <Kb.Text backgroundMode="Terminal" type="Header">
          Get free Lumens every month
        </Kb.Text>
        <Kb.Text type="Body">
          Monthly starting March 1, Keybase will divide 50,000 XLM (Stellar Lumens) among Keybase users.
        </Kb.Text>
        <Kb.Button
          type="PrimaryColoredBackground"
          backgroundMode="Purple"
          label="See if you qualify"
          onClick={p.onCheckQualify}
          style={styles.button}
        />
      </Kb.Box2>
      <Kb.Icon type="iconfont-close" onClick={p.onCancel} style={styles.close} />
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate({
  button: {alignSelf: 'flex-start'},
  close: {padding: Styles.globalMargins.xxtiny},
  container: {
    backgroundColor: Styles.globalColors.purple2,
    padding: Styles.globalMargins.small,
  },
  starContainer: {
    height: '100%',
    width: 180,
  },
  textContainer: {
    flexGrow: 1,
  },
})

export default Banner
