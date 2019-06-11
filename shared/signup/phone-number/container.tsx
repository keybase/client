import * as Container from '../../util/container'
import * as SignupGen from '../../actions/signup-gen'
import EnterPhoneNumber from '.'

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({})

const ConnectedEnterPhoneNumber = Container.connect(mapStateToProps, mapDispatchToProps)(EnterPhoneNumber)

export default ConnectedEnterPhoneNumber
