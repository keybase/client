import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Modal from '../modal'

const Import = () => (
  <Modal closeType="onBack">
    <Kb.Icon type="icon-pgp-key-import-48" />
    <Kb.Text style={styles.header} type="Header">
      Import a PGP key
    </Kb.Text>
    <Kb.Text style={styles.body} type="Body">
      To register your existing PGP public key on Keybase, please run the following command from your
      terminal:
    </Kb.Text>
    <Kb.Box style={styles.terminal}>
      <Kb.Text type="TerminalComment"># import a key from gpg's key chain</Kb.Text>
      <Kb.Text type="Terminal">keybase pgp select</Kb.Text>
      <Kb.Text type="TerminalEmpty" />
      <Kb.Text type="TerminalComment"># for more options</Kb.Text>
      <Kb.Text type="Terminal">keybase pgp help</Kb.Text>
    </Kb.Box>
  </Modal>
)

const styles = Styles.styleSheetCreate(() => ({
  body: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
  },
  header: {
    marginTop: Styles.globalMargins.medium,
  },
  terminal: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.blueDarker2,
    borderRadius: 4,
    boxSizing: 'content-box',
    color: Styles.globalColors.white,
    marginLeft: -Styles.globalMargins.medium,
    marginRight: -Styles.globalMargins.medium,
    padding: Styles.globalMargins.medium,
    textAlign: 'left',
  },
}))

export default Import
