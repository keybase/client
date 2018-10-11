// @flow
import {SecretNote as SecretNoteComponent, PublicMemo as PublicMemoComponent} from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'

const secretNoteConnector = {
  mapStateToProps: state => {
    const recipientType = state.wallets.building.recipientType
    const building = state.wallets.building
    const built = building.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment
    return {
      secretNote: building.secretNote.stringValue(),
      secretNoteError: built.secretNoteErrMsg.stringValue(),
      toSelf: recipientType === 'otherAccount',
    }
  },
  mapDispatchToProps: (dispatch, ownProps) => ({
    onChangeSecretNote: (secretNote: string) =>
      dispatch(WalletsGen.createSetBuildingSecretNote({secretNote: new HiddenString(secretNote)})),
  }),
}

const publicMemoConnector = {
  mapStateToProps: state => {
    const building = state.wallets.building
    const built = state.wallets.builtPayment
    return {
      publicMemo: building.publicMemo.stringValue(),
      publicMemoError: built.publicMemoErrMsg.stringValue(),
    }
  },
  mapDispatchToProps: (dispatch, ownProps) => ({
    onChangePublicMemo: (publicMemo: string) =>
      dispatch(
        WalletsGen.createSetBuildingPublicMemo({
          publicMemo: new HiddenString(publicMemo),
        })
      ),
  }),
}

export const SecretNote = compose(
  connect(
    secretNoteConnector.mapStateToProps,
    secretNoteConnector.mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  setDisplayName('ConnectedSecretNote')
)(SecretNoteComponent)

export const PublicMemo = compose(
  connect(
    publicMemoConnector.mapStateToProps,
    publicMemoConnector.mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  setDisplayName('ConnectedPublicMemo')
)(PublicMemoComponent)
