import SystemInviteAccepted from '.'
import * as Types from '../../../../constants/types/chat2'
import {connect} from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemSBSResolbed
}

const mapStateToProps = state => ({
  you: state.config.username,
})

export default connect(
  mapStateToProps,
  () => {},
  (stateProps, _, ownProps: OwnProps) => ({
    message: ownProps.message,
    you: stateProps.you,
  })
)(SystemInviteAccepted)
