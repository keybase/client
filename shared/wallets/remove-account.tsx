import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import WalletPopup, {walletModalIconStyle} from './wallet-popup'
import {makeReallyRemoveAccountRouteParams} from './account-utils'

type OwnProps = {
  accountID: string
  balanceDescription: string
  name: string
}

const RemoveAccountPopup = (ownProps: OwnProps) => {
  const {accountID, balanceDescription, name} = ownProps
  const onDelete = () => {
    C.Router2.navigateAppend(
      {name: 'reallyRemoveAccount', params: makeReallyRemoveAccountRouteParams({accountID, name})},
      true
    )
  }

  const buttons = [
    <Kb.Button fullWidth={isMobile} key={0} label="Cancel" onClick={C.Router2.navigateUp} type="Dim" />,
    <Kb.Button
      fullWidth={isMobile}
      key={1}
      label="Yes, remove"
      onClick={onDelete}
      type="Danger"
    />,
  ]

  return (
    <WalletPopup
      bottomButtons={isMobile ? buttons.reverse() : buttons}
    >
      <Kb.Box2 centerChildren={true} direction="vertical" flex={1} fullWidth={true}>
        <Kb.IconAuto
          type={isMobile ? 'icon-wallet-remove-64' : 'icon-wallet-remove-48'}
          style={walletModalIconStyle}
        />
        <Kb.Text center={true} style={styles.warningText} type="Header">
          This removes{' '}
        </Kb.Text>
        <Kb.Text center={true} type="HeaderItalic" style={styles.warningText}>
          {name}
        </Kb.Text>
        <Kb.Text
          center={true}
          style={Kb.Styles.collapseStyles([styles.warningText, styles.marginBottomTiny])}
          type="Header"
        >
          {' '}
          from Keybase, but you can still use it elsewhere if you save the private key.
        </Kb.Text>
        <Kb.Text type="BodySmall">Balance:</Kb.Text>
        <Kb.Text type="BodySmallExtrabold">{balanceDescription}</Kb.Text>
      </Kb.Box2>
    </WalletPopup>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  marginBottomTiny: {marginBottom: Kb.Styles.globalMargins.tiny},
  warningText: Kb.Styles.platformStyles({
    isElectron: {wordBreak: 'break-word'} as const,
    isMobile: {
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.medium),
    },
  }),
}))

export default RemoveAccountPopup
