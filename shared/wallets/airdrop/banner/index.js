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
    <Kb.Box2 noShrink={true} fullWidth={true} direction="horizontal" style={styles.container} gap="small">
      <Kb.Box2 direction="horizontal" centerChildren={true}>
        <Kb.Icon type="iconfont-nav-wallets" />
      </Kb.Box2>
      <Kb.Markdown styleOverride={markdownOverride} style={styles.markdown}>
        Starting March 1, Keybase will divide *50,000 XLM* (Stellar Lumens) among qualified Keybase users,
        every month.
      </Kb.Markdown>
      <Kb.Button
        type="PrimaryColoredBackground"
        backgroundMode="Purple"
        label="Join the airdrop"
        onClick={p.onCheckQualify}
        style={styles.button}
      />
      <Kb.Box2 direction="vertical" style={styles.grow} />
      <Kb.Icon type="iconfont-close" onClick={p.onCancel} style={styles.close} />
    </Kb.Box2>
  ) : null

const markdownOverride = {
  paragraph: {
    color: Styles.globalColors.white,
  },
}

const styles = Styles.styleSheetCreate({
  button: {alignSelf: 'flex-start'},
  close: {padding: Styles.globalMargins.xxtiny},
  container: {
    backgroundColor: Styles.globalColors.purple2,
    padding: Styles.globalMargins.small,
  },
  grow: {flexGrow: 1, flexShrink: 1},
  markdown: {alignSelf: 'center'},
  textContainer: {
    flexGrow: 1,
    flexShrink: 1,
  },
})

export default Banner
