import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/wallets'

type Props = {
  assets: Array<{code: string; issuerVerifiedDomain: string}>
  onSetupTrustline: () => void
  refresh: () => void
}

const WalletSettingTrustline = (props: Props) => (
  <Kb.Box>
    <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} alignItems="flex-start">
      <Kb.Text type="BodySmallSemibold">Trustlines</Kb.Text>
      <Kb.Text type="BodySmall" style={styles.description}>
        To receive assets on the Stellar network, you must first "accept" their trustline. Stellar holds 0.5
        XLM per trustline from your Lumen balance.
      </Kb.Text>
      {props.assets.map((asset, index) => (
        <React.Fragment key={index.toString()}>
          <Kb.Text type="BodyExtrabold" lineClamp={1} ellipsizeMode="tail" style={styles.code}>
            {asset.code}
          </Kb.Text>
          {asset.issuerVerifiedDomain ? (
            <Kb.Text type="BodySmall">{asset.issuerVerifiedDomain}</Kb.Text>
          ) : (
            <Kb.Text type="BodySmallItalic" style={styles.textUnknown}>
              Unknown
            </Kb.Text>
          )}
        </React.Fragment>
      ))}
      <Kb.Button
        mode="Secondary"
        label={props.assets.length ? 'Accept other trustlines' : 'Accept trustlines'}
        onClick={props.onSetupTrustline}
        style={styles.button}
      />
    </Kb.Box2>
    <Kb.Divider />
  </Kb.Box>
)

export default WalletSettingTrustline

const styles = Styles.styleSheetCreate({
  button: {
    flexShrink: 1,
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.tiny,
  },
  code: {
    marginTop: Styles.globalMargins.tiny,
  },
  container: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  description: {
    marginTop: Styles.globalMargins.xtiny,
  },

  textUnknown: {color: Styles.globalColors.red},
})
