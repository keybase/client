import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {makeReallyRemoveAccountRouteParams} from './account-utils'

type OwnProps = {
  accountID: string
  balanceDescription: string
  name: string
}

const RemoveAccountPopup = (ownProps: OwnProps) => {
  const styles = useStyles()
  const {accountID, balanceDescription, name} = ownProps
  const onDelete = () => {
    C.Router2.navigateAppend(
      {name: 'reallyRemoveAccount', params: makeReallyRemoveAccountRouteParams({accountID, name})},
      true
    )
  }

  return (
    <Kb.ModalScreen
      centered={true}
      footer={
        <Kb.ConfirmButtons
          split={true}
          onCancel={C.Router2.navigateUp}
          onConfirm={onDelete}
          confirmLabel="Yes, remove"
          confirmType="Danger"
        />
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" gap="tiny" style={styles.container}>
        <Kb.IconAuto type={isMobile ? 'icon-wallet-remove-64' : 'icon-wallet-remove-48'} style={styles.icon} />
        <Kb.Text center={true} type="BodyBig" style={styles.warningText}>
          This removes <Kb.Text type="BodyBigExtrabold">{name}</Kb.Text> from Keybase, but you can still use it
          elsewhere if you save the private key.
        </Kb.Text>
        <Kb.Text type="BodySmall">Balance:</Kb.Text>
        <Kb.Text type="BodySmallExtrabold">{balanceDescription}</Kb.Text>
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  container: {paddingTop: Kb.Styles.globalMargins.small},
  icon: {marginBottom: Kb.Styles.globalMargins.small},
  warningText: Kb.Styles.platformStyles({
    isElectron: {wordBreak: 'break-word'} as const,
  }),
}))

export default RemoveAccountPopup
