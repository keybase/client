import {SecretNote as SecretNoteComponent, PublicMemo as PublicMemoComponent} from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Container from '../../../util/container'
import HiddenString from '../../../util/hidden-string'

export const SecretNote = () => {
  const recipientType = Container.useSelector(state => state.wallets.building.recipientType)
  const building = Container.useSelector(state => state.wallets.building)
  const built = Container.useSelector(state =>
    building.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment
  )
  // TODO is this ok
  const maxLength = Container.useSelector(state =>
    state.wallets.staticConfig
      ? building.isRequest
        ? state.wallets.staticConfig.requestNoteMaxLength
        : state.wallets.staticConfig.paymentNoteMaxLength
      : 0
  )
  const secretNote = building.secretNote.stringValue()
  const secretNoteError = built.secretNoteErrMsg.stringValue()
  const toSelf = recipientType === 'otherAccount'

  const dispatch = Container.useDispatch()
  const onChangeSecretNote = (secretNote: string) => {
    dispatch(WalletsGen.createSetBuildingSecretNote({secretNote: new HiddenString(secretNote)}))
  }
  const props = {
    maxLength,
    onChangeSecretNote,
    secretNote,
    secretNoteError,
    toSelf,
  }
  return <SecretNoteComponent {...props} />
}

export const PublicMemo = () => {
  const building = Container.useSelector(state => state.wallets.building)
  const built = Container.useSelector(state => state.wallets.builtPayment)
  const maxLength = Container.useSelector(state =>
    state.wallets.staticConfig ? state.wallets.staticConfig.publicMemoMaxLength : 0
  )
  const publicMemo = building.publicMemo.stringValue()
  const publicMemoError = built.publicMemoErrMsg.stringValue()
  const publicMemoOverride = built.publicMemoOverride.stringValue()

  const dispatch = Container.useDispatch()
  const onChangePublicMemo = (publicMemo: string) => {
    dispatch(
      WalletsGen.createSetBuildingPublicMemo({
        publicMemo: new HiddenString(publicMemo),
      })
    )
  }
  const props = {
    maxLength,
    onChangePublicMemo,
    publicMemo,
    publicMemoError,
    publicMemoOverride,
  }
  return <PublicMemoComponent {...props} />
}
