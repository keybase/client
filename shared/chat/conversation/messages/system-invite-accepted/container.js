// @flow
import SystemInviteAccepted from '.'
import {connect, type TypedState} from '../../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  you: state.config.username,
})

const mapDispatchToProps = () => ({})

export default connect(mapStateToProps, mapDispatchToProps)(SystemInviteAccepted)
