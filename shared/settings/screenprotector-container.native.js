// @flow
import Screenprotector from './screenprotector.native'
import * as Container from '../util/container'

type OwnProps = Container.RouteProps<{}, {}>

const mapStateToProps = () => ({
  title: 'Screen Protector',
})
const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
})

export default Container.connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Screenprotector)
