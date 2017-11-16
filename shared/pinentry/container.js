// @flow
import {connect, compose, renderNothing, branch} from '../util/container'
import Pinentry from '.'

const mapStateToProps = (state, {sessionID}) => state.pinentry.pinentryStates[sessionID] || {}
export default compose(connect(mapStateToProps), branch(props => !props.features, renderNothing))(Pinentry)
