// @flow
import Screenprotector from './screenprotector.native'
import * as Container from '../util/container'

const mapStateToProps = () => ({
  title: 'Screen Protector',
})
const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Screenprotector)
