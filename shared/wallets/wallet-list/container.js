// @flow
import {WalletList} from '.'
import {connect, type TypedState, type Dispatch} from '../../util/container'

const common = {
  isSelected: false,
  name: '',
  keybaseUser: '',
  contents: '',
}

const mockWallets = [
  {
    ...common,
    keybaseUser: 'cecileb',
    isSelected: true,
    name: "cecileb's wallet",
    contents: '280.0871234 XLM + more',
  },
  {
    ...common,
    name: 'Second wallet',
    contents: '56.9618203 XLM',
  },
]

const mapStateToProps = (state: TypedState) => ({
  wallets: mockWallets,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onAddNew: () => {
    console.log('TODO: onAddNew')
  },
  onLinkExisting: () => {
    console.log('TODO: onAddNew')
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  wallets: stateProps.wallets,
  onAddNew: dispatchProps.onAddNew,
  onLinkExisting: dispatchProps.onLinkExisting,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(WalletList)
