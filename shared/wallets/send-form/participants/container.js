// @flow
import Participants from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  // Building section
  const recipientType = build.recipientType || 'keybaseUser'
  // Built section
  const incorrect = built.toErrMsg
  const recipientUsername = built.toUsername

  // TODO: Set these to actual values, this is just to make flow happy until we integrate
  const onLinkAccount = () => {}
  const onCreateNewAccount = () => {}
  const onChangeFromAccount = () => {}
  const onChangeToAccount = () => {}
  const fromAccount = {
    user: '',
    name: '',
    contents: '',
  }
  const allAccounts = []

  return {
    incorrect,
    recipientType,
    recipientUsername,
    onCreateNewAccount,
    onLinkAccount,
    onChangeFromAccount,
    onChangeToAccount,
    fromAccount,
    allAccounts,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onChangeRecipient: (to: string) => dispatch(WalletsGen.createSetBuildingTo({to})),
  onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('Participants')
)(Participants)
