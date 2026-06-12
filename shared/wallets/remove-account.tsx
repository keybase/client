import * as C from '@/constants'
import * as Kb from '@/common-adapters'
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
    <>
      <Kb.ScrollView
        alwaysBounceVertical={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
          <Kb.IconAuto
            type={isMobile ? 'icon-wallet-remove-64' : 'icon-wallet-remove-48'}
            style={styles.icon}
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
      </Kb.ScrollView>
      <Kb.ModalFooter>
        <Kb.ButtonBar direction={isMobile ? 'column' : 'row'} fullWidth={isMobile} style={styles.buttonBar}>
          {isMobile ? buttons.reverse() : buttons}
        </Kb.ButtonBar>
      </Kb.ModalFooter>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonBar: Kb.Styles.platformStyles({
    isElectron: {minHeight: 0},
  }),
  container: Kb.Styles.platformStyles({
    common: {flexGrow: 1},
    isElectron: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xlarge, Kb.Styles.globalMargins.medium),
      textAlign: 'center',
    },
  }),
  icon: Kb.Styles.platformStyles({
    common: {marginBottom: Kb.Styles.globalMargins.large},
    isElectron: {marginTop: Kb.Styles.globalMargins.medium},
    isMobile: {marginTop: Kb.Styles.globalMargins.xlarge},
  }),
  marginBottomTiny: {marginBottom: Kb.Styles.globalMargins.tiny},
  scrollContent: {...Kb.Styles.globalStyles.flexBoxColumn, ...Kb.Styles.globalStyles.flexGrow},
  scrollView: Kb.Styles.globalStyles.flexOne,
  warningText: Kb.Styles.platformStyles({
    isElectron: {wordBreak: 'break-word'} as const,
    isMobile: {
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.medium),
    },
  }),
}))

export default RemoveAccountPopup
