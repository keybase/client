// @noflow
import {connect} from '../__mocks__/react-redux'
// Monkeypatch redux connect
const redux = require('react-redux')
// $FlowIssue doens't like writing over readonly stuff :)
redux.connect = connect
