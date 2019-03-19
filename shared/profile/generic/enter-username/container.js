// @flow
import * as Container from '../../../util/container'
import EnterUsername from '.'

type OwnProps = Container.RouteProps<{}, {}>

const mapStateToProps = () => ({}) // TODO

const mapDispatchToProps = () => ({}) // TODO

const mergeProps = () => ({
  error: '',
  onBack: () => {},
  onChangeUsername: () => {},
  onSubmit: () => {},
  serviceIcon: [],
  serviceIconFull: [],
  serviceName: '',
  serviceSub: '',
  unreachable: false,
  username: '',
})

const ConnectedEnterUsername = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedEnterUsername'
)(EnterUsername)

export default ConnectedEnterUsername
