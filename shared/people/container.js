// @flow
import People from '.'
import {connect} from 'react-redux'
import {type TypedState} from '../util/container'
// import flags from '../util/feature-flags'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(People)
