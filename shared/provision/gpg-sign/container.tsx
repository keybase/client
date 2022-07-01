import * as ProvisionGen from '../../actions/provision-gen'
import * as Container from '../../util/container'
import GPGSign from '.'

type OwnProps = {}

export default Container.connect(
  state => ({importError: state.provision.gpgImportError}),
  dispatch => ({
    onAcceptGpgSign: () => dispatch(ProvisionGen.createSubmitGPGSignOK({accepted: true})),
    // TODO remove
    onBack: () => {},
    onRejectGpgSign: () => dispatch(ProvisionGen.createSubmitGPGSignOK({accepted: false})),
    onSubmitGpgMethod: (exportKey: boolean) => dispatch(ProvisionGen.createSubmitGPGMethod({exportKey})),
  }),
  // If we are asked to switch to gpg sign, we either accept or reject.
  (stateProps, dispatchProps, _: OwnProps) => ({
    importError: stateProps.importError,
    onBack: stateProps.importError ? dispatchProps.onRejectGpgSign : dispatchProps.onBack,
    onSubmit: stateProps.importError ? dispatchProps.onAcceptGpgSign : dispatchProps.onSubmitGpgMethod,
  })
)(GPGSign)
