// @flow
import NoteAndMemo from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'

const mapStateToProps = (state: TypedState) => {
  const b = state.wallets.builtPayment
  return {
    memoError: b.publicMemoErrMsg.stringValue(),
    noteError: b.secretNoteErrMsg.stringValue(),
    toSelf: false, // TODO
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
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
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('NoteAndMemo')
)(NoteAndMemo)
