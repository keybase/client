// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import {connect} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'
import type {TypedState} from '../../constants/reducer'
import GPGSign from '.'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  importError: state.provision.gpgImportError,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmitGpgMethod: exportKey => dispatch(ProvisionGen.createSubmitGPGMethod({exportKey})),
  onAcceptGpgSign: () => dispatch(ProvisionGen.createSubmitGPGSignOK({accepted: true})),
  onRejectGpgSign: () => dispatch(ProvisionGen.createSubmitGPGSignOK({accepted: false})),
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
