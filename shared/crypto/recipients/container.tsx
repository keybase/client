import * as Container from '../../util/container'
import * as Types from '../../constants/types/crypto'
import * as CryptoGen from '../../actions/crypto-gen'
import {appendEncryptRecipientsBuilder} from '../../actions/typed-routes'
import Recipients from '.'

type OwnProps = {
  operation: Types.Operations
}

export default Container.namedConnect(
  (state: Container.TypedState) => ({
    recipients: state.crypto.encrypt.recipients,
  }),
  dispatch => ({
    onAddRecipients: () => dispatch(appendEncryptRecipientsBuilder()),
    onClearRecipients: (operation: Types.Operations) =>
      dispatch(CryptoGen.createClearRecipients({operation})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    onAddRecipients: dispatchProps.onAddRecipients,
    onClearRecipients: () => dispatchProps.onClearRecipients(ownProps.operation),
    recipients: stateProps.recipients,
  }),
  'Recipients'
)(Recipients)
