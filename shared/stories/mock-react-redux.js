// @flow
import {connect} from '../__mocks__/react-redux'
// Monkeypatch redux connect
const redux = require('react-redux')
redux.connect = connect
