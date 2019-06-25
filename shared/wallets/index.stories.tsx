import asset from './asset/index.stories'
import banner from './banner/index.stories'
import common from './common/index.stories'
import createAccount from './create-account/index.stories'
import linkExisting from './link-existing/index.stories'
import onboarding from './onboarding/index.stories'
import sendForm from './send-form/index.stories'
import confirmForm from './confirm-form/index.stories'
import receiveModal from './receive-modal/index.stories'
import exportSecretKey from './export-secret-key/index.stories'
import transaction from './transaction/index.stories'
import transactionDetails from './transaction-details/index.stories'
import walletList from './wallet-list/index.stories'
import wallet from './wallet/index.stories'
import walletSwitcherRow from './wallet/header/wallet-switcher/wallet-row/index.stories'
import whatIsStellarModal from './what-is-stellar-modal/index.stories'
import airdrop from './airdrop/index.stories'
import trustline from './trustline/index.stories'

const load = () => {
  airdrop()
  asset()
  banner()
  common()
  createAccount()
  exportSecretKey()
  linkExisting()
  onboarding()
  receiveModal()
  sendForm()
  confirmForm()
  walletList()
  wallet()
  walletSwitcherRow()
  whatIsStellarModal()
  transaction()
  transactionDetails()
  trustline()
}

export default load
