import * as React from 'react'
import * as Types from '../../../../constants/types/wallets'

export type Props = {
  accountIDs: Array<Types.AccountID>
  getAttachmentRef: (() => React.Component<any>) | null
  hideMenu: () => void
  onAddNew: () => void
  onJoinAirdrop: () => void
  onLinkExisting: () => void
  onWhatIsStellar: () => void
  showingMenu: boolean
}

export declare class WalletSwitcher extends React.Component<Props> {}
