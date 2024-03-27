import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import Modal from '@/profile/modal'

export default function Import() {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  return (
    <Modal onCancel={onCancel}>
      <Kb.Icon type="icon-pgp-key-import-48" />
      <Kb.Text style={styleHeader} type="Header">
        Import a PGP key
      </Kb.Text>
      <Kb.Text style={styleBody} type="Body">
        To register your existing PGP public key on Keybase, please run the following command from your
        terminal:
      </Kb.Text>
      <Kb.Box style={styleTerminal}>
        <Kb.Text type="TerminalComment"># import a key from gpg's key chain</Kb.Text>
        <Kb.Text type="Terminal">keybase pgp select</Kb.Text>
        <Kb.Text type="TerminalEmpty" />
        <Kb.Text type="TerminalComment"># for more options</Kb.Text>
        <Kb.Text type="Terminal">keybase pgp help</Kb.Text>
      </Kb.Box>
    </Modal>
  )
}

const styleHeader = {
  marginTop: Kb.Styles.globalMargins.medium,
}

const styleBody = {
  marginBottom: Kb.Styles.globalMargins.small,
  marginTop: Kb.Styles.globalMargins.small,
}

const styleTerminal = {
  ...Kb.Styles.globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  backgroundColor: Kb.Styles.globalColors.blueDarker2,
  borderRadius: 4,
  boxSizing: 'content-box',
  color: Kb.Styles.globalColors.white,
  marginLeft: -Kb.Styles.globalMargins.medium,
  marginRight: -Kb.Styles.globalMargins.medium,
  padding: Kb.Styles.globalMargins.medium,
  textAlign: 'left',
} as const
