// @flow
import Participants from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'

const mapStateToProps = (state: TypedState) => {
  // Building section
  const recipientType = state.wallets.get('buildingPayment').get('recipientType')
  const to = state.wallets.get('buildingPayment').get('to')
  const recipientStellarAddress = recipientType === 'stellarPublicKey' && to

  // Built section
  const incorrect = state.wallets.get('builtPayment').get('toErrMsg')
  const recipientUsername = state.wallets.get('builtPayment').get('toUsername')
  const worthDescription = state.wallets.get('builtPayment').get('worthDescription')
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
