// @flow
import NoteAndMemo from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'

const mapStateToProps = (state: TypedState) => ({})

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

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('NoteAndMemo'))(
  NoteAndMemo
)
