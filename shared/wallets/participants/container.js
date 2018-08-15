// @flow
import Participants from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'

const mapStateToProps = (state: TypedState) => {
  const recipientType = state.wallets.get('buildingPayment').get('recipientType')
  const to = state.wallets.get('buildingPayment').get('to')
  const recipientStellarAddress = recipientType === 'stellarPublicKey' && to
  return {
    recipientStellarAddress,
    recipientType,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onChangeAddress: (to: string) => dispatch(WalletsGen.createSetBuildingTo({to})),
})

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('Participants'))(
  Participants
)
