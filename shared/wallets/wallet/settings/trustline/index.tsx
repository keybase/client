import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  assets: Array<{code: string; desc: string}>
  onSetupTrustline: () => void
  refresh: () => void
  thisDeviceIsLockedOut: boolean
}

const WalletSettingTrustline = (props: Props) => {
  const {refresh} = props
  React.useEffect(() => {
    refresh()
  }, [refresh])
  return (
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
            <Kb.Text type="BodySmall">{asset.desc}</Kb.Text>
          </React.Fragment>
        ))}
        {props.thisDeviceIsLockedOut && (
          <Kb.Text style={styles.lockedOut} type="BodySmall">
            Trustlines can only be managed from a mobile device over 7 days old.
          </Kb.Text>
        )}
        <Kb.Button
          disabled={props.thisDeviceIsLockedOut}
          mode="Secondary"
          label={props.assets.length ? 'Manage trustlines' : 'Accept trustlines'}
          onClick={props.onSetupTrustline}
          style={styles.button}
        />
      </Kb.Box2>
      <Kb.Divider />
    </Kb.Box>
  )
}

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
  lockedOut: {
    marginTop: Styles.globalMargins.tiny,
  },
  textUnknown: {color: Styles.globalColors.redDark},
})
