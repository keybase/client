import * as ProfileGen from '../../actions/profile-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import Modal from '../modal'

const Info = () => {
  const email1 = Container.useSelector(state => state.profile.pgpEmail1)
  const email2 = Container.useSelector(state => state.profile.pgpEmail2)
  const email3 = Container.useSelector(state => state.profile.pgpEmail3)
  const errorEmail1 = Container.useSelector(state => state.profile.pgpErrorEmail1)
  const errorEmail2 = Container.useSelector(state => state.profile.pgpErrorEmail2)
  const errorEmail3 = Container.useSelector(state => state.profile.pgpErrorEmail3)
  const errorText = Container.useSelector(state => state.profile.pgpErrorText)
  const fullName = Container.useSelector(state => state.profile.pgpFullName)
  const dispatch = Container.useDispatch()
  const onCancel = () => dispatch(RouteTreeGen.createNavigateUp())
  const onChangeEmail1 = (pgpEmail1: string) => dispatch(ProfileGen.createUpdatePgpInfo({pgpEmail1}))
  const onChangeEmail2 = (pgpEmail2: string) => dispatch(ProfileGen.createUpdatePgpInfo({pgpEmail2}))
  const onChangeEmail3 = (pgpEmail3: string) => dispatch(ProfileGen.createUpdatePgpInfo({pgpEmail3}))
  const onChangeFullName = (pgpFullName: string) => dispatch(ProfileGen.createUpdatePgpInfo({pgpFullName}))
  const onNext = () => dispatch(ProfileGen.createGeneratePgp())
  const nextDisabled = !email1 || !fullName || !!errorText
  return (
    <Modal onCancel={onCancel} skipButton={true}>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.content}>
        <Kb.PlatformIcon platform="pgp" overlay="icon-proof-unfinished" style={styles.centered} />
        <Kb.Text type="BodySemibold" style={styles.centered}>
          Fill in your public info.
        </Kb.Text>
        <Kb.LabeledInput
          autoFocus={true}
          placeholder="Your full name"
          value={fullName}
          onChangeText={onChangeFullName}
        />
        <Kb.LabeledInput
          placeholder="Email 1"
          onChangeText={onChangeEmail1}
          onEnterKeyDown={onNext}
          value={email1}
          error={errorEmail1}
        />
        <Kb.LabeledInput
          placeholder="Email 2 (optional)"
          onChangeText={onChangeEmail2}
          onEnterKeyDown={onNext}
          value={email2}
          error={errorEmail2}
        />
        <Kb.LabeledInput
          placeholder="Email 3 (optional)"
          onChangeText={onChangeEmail3}
          onEnterKeyDown={onNext}
          value={email3}
          error={errorEmail3}
        />
        <Kb.Text type={errorText ? 'BodySmallError' : 'BodySmall'}>
          {errorText || 'Include any addresses you plan to use for PGP encrypted email.'}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 fullWidth={true} direction="horizontal" gap="small">
        <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
        <Kb.Button label="Let the math begin" disabled={nextDisabled} onClick={onNext} style={styles.math} />
      </Kb.Box2>
    </Modal>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      centered: {alignSelf: 'center'},
      content: {flexGrow: 1},
      math: {flexGrow: 1},
    } as const)
)
export default Info
