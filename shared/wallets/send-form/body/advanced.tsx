import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {sharedStyles} from './shared'
import * as Container from '../../../util/container'
import * as WalletsGen from '../../../actions/wallets-gen'
import FooterAdvanced from '../footer/footer-advanced'
import HiddenString from '../../../util/hidden-string'
import {SecretNote, PublicMemo} from '../note-and-memo'
import {
  AssetInputRecipientAdvanced,
  AssetInputSenderAdvanced,
  AssetPathIntermediate,
} from '../asset-input/asset-input-advanced'

type SendBodyAdvancedProps = {}

const SecretNoteAndPublicMemo = () => {
  const dispatch = Container.useDispatch()
  const onChangeSecretNote = React.useCallback(
    secretNote => {
      dispatch(WalletsGen.createSetBuildingAdvancedSecretNote({secretNote: new HiddenString(secretNote)}))
    },
    [dispatch]
  )
  const onChangePublicMemo = React.useCallback(
    publicMemo => {
      dispatch(WalletsGen.createSetBuildingAdvancedPublicMemo({publicMemo: new HiddenString(publicMemo)}))
    },
    [dispatch]
  )

  const buildingAdvanced = Container.useSelector(state => state.wallets.buildingAdvanced)
  const secretNote = buildingAdvanced.secretNote.stringValue()
  const publicMemo = buildingAdvanced.publicMemo.stringValue()

  // We currently don't support path payment requests, so no need to check if this is a request
  const secretNoteMaxLength = Container.useSelector(state =>
    state.wallets.staticConfig ? state.wallets.staticConfig.paymentNoteMaxLength : 0
  )
  const publicMemoMaxLength = Container.useSelector(state =>
    state.wallets.staticConfig ? state.wallets.staticConfig.publicMemoMaxLength : 0
  )
  return (
    <>
      <SecretNote
        secretNote={secretNote}
        onChangeSecretNote={onChangeSecretNote}
        toSelf={buildingAdvanced.recipientType === 'otherAccount'}
        secretNoteError={'' /* TODO PICNIC-142 */}
        maxLength={secretNoteMaxLength}
      />
      <PublicMemo
        publicMemo={publicMemo}
        onChangePublicMemo={onChangePublicMemo}
        publicMemoError={'' /* TODO PICNIC-142 */}
        maxLength={publicMemoMaxLength}
      />
    </>
  )
}

const SendBodyAdvanced = (_: SendBodyAdvancedProps) => (
  <Kb.Box2 fullWidth={true} direction="vertical" style={sharedStyles.container}>
    <Kb.ScrollView style={sharedStyles.scrollView}>
      <AssetInputRecipientAdvanced />
      <AssetPathIntermediate />
      <AssetInputSenderAdvanced />
      <Kb.Divider />
      <SecretNoteAndPublicMemo />
    </Kb.ScrollView>
    <FooterAdvanced />
  </Kb.Box2>
)

export default SendBodyAdvanced
