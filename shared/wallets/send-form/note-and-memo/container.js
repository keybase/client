// @flow
import NoteAndMemo from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'

const mapStateToProps = (state: TypedState) => {
  const recipientType = state.wallets.buildingPayment.recipientType
  const built = state.wallets.builtPayment
  const building = state.wallets.buildingPayment
  return {
    publicMemo: building.publicMemo.stringValue(),
    publicMemoError: built.publicMemoErrMsg.stringValue(),
    secretNote: building.secretNote.stringValue(),
    secretNoteError: built.secretNoteErrMsg.stringValue(),
    toSelf: recipientType === 'otherAccount',
  }
}

const mapDispatchToProps = (dispatch) => ({
  onChangePublicMemo: (publicMemo: string) =>
    dispatch(
      WalletsGen.createSetBuildingPublicMemo({
        publicMemo: new HiddenString(publicMemo),
      })
    ),
  onChangeSecretNote: (secretNote: string) =>
    dispatch(WalletsGen.createSetBuildingSecretNote({secretNote: new HiddenString(secretNote)})),
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  setDisplayName('NoteAndMemo')
)(NoteAndMemo)
