// @flow
import Participants from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  // Building section
  const recipientType = build.recipientType || 'keybaseUser'
  const to = build.to
  const recipientStellarAddress = recipientType === 'stellarPublicKey' ? to : ''

  // Built section
  const incorrect = built.toErrMsg
  const recipientUsername = built.toUsername

  return {
    incorrect,
    recipientStellarAddress,
    recipientType,
    recipientUsername,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onChangeAddress: (to: string) => dispatch(WalletsGen.createSetBuildingTo({to})),
  onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('Participants')
)(Participants)
