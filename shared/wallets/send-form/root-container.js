// @flow
import Root from './root'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({})

const mergeProps = (stateProps, dispatchProps, {isRequest, onClose, onLinkAccount, onCreateNewAccount}) => ({
  isRequest,
  onClose,
  onLinkAccount,
  onCreateNewAccount,
  // TODO: get bannerInfo and isProcessing?
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Root)
