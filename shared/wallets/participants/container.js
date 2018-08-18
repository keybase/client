// @flow
import Participants from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'

const mapStateToProps = (state: TypedState) => {
  // Building section
  const recipientType = state.wallets.buildingPayment.recipientType
  const to = state.wallets.buildingPayment.to
  const recipientStellarAddress = recipientType === 'stellarPublicKey' && to

  // Built section
  const incorrect = state.wallets.builtPayment.toErrMsg
  const recipientUsername = state.wallets.builtPayment.toUsername
  const worthDescription = state.wallets.builtPayment.worthDescription

  return {
    incorrect,
    recipientStellarAddress,
    recipientType,
    recipientUsername,
    worthDescription,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onChangeAddress: (to: string) => dispatch(WalletsGen.createSetBuildingTo({to})),
  onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
})

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('Participants'))(
  Participants
)
