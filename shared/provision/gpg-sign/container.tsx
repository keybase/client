import * as ProvisionGen from '../../actions/provision-gen'
import {connect} from '../../util/container'
import {RouteProps} from '../../route-tree/render-route'
import GPGSign from '.'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  importError: state.provision.gpgImportError,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onAcceptGpgSign: () => dispatch(ProvisionGen.createSubmitGPGSignOK({accepted: true})),
  // TODO remove
  onBack: () => {},
  onRejectGpgSign: () => dispatch(ProvisionGen.createSubmitGPGSignOK({accepted: false})),
  onSubmitGpgMethod: exportKey => dispatch(ProvisionGen.createSubmitGPGMethod({exportKey})),
})

// If we are asked to switch to gpg sign, we either accept or reject.
const mergeProps = ({importError}, dispatchProps) =>
  importError
    ? {
        importError,
        onBack: dispatchProps.onRejectGpgSign,
        onSubmit: _ => dispatchProps.onAcceptGpgSign(),
      }
    : {
        importError,
        onBack: dispatchProps.onBack,
        onSubmit: dispatchProps.onSubmitGpgMethod,
      }

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(GPGSign)
