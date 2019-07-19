import {SecretNote as SecretNoteComponent, PublicMemo as PublicMemoComponent} from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {namedConnect} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'

type OwnProps = {}

export const SecretNote = namedConnect(
  state => {
    const recipientType = state.wallets.building.recipientType
    const building = state.wallets.building
    const built = building.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment
    // TODO is this ok
    const maxLength = state.wallets.staticConfig
      ? building.isRequest
        ? state.wallets.staticConfig.requestNoteMaxLength
        : state.wallets.staticConfig.paymentNoteMaxLength
      : 0
    return {
      maxLength,
      secretNote: building.secretNote.stringValue(),
      secretNoteError: built.secretNoteErrMsg.stringValue(),
      toSelf: recipientType === 'otherAccount',
    }
  },
  dispatch => ({
    onChangeSecretNote: (secretNote: string) =>
      dispatch(WalletsGen.createSetBuildingSecretNote({secretNote: new HiddenString(secretNote)})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'ConnectedSecretNote'
)(SecretNoteComponent)

export const PublicMemo = namedConnect(
  state => {
    const building = state.wallets.building
    const built = state.wallets.builtPayment
    const maxLength = state.wallets.staticConfig ? state.wallets.staticConfig.publicMemoMaxLength : 0
    return {
      maxLength,
      publicMemo: building.publicMemo.stringValue(),
      publicMemoError: built.publicMemoErrMsg.stringValue(),
    }
  },
  dispatch => ({
    onChangePublicMemo: (publicMemo: string) =>
      dispatch(
        WalletsGen.createSetBuildingPublicMemo({
          publicMemo: new HiddenString(publicMemo),
        })
      ),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'ConnectedPublicMemo'
)(PublicMemoComponent)
