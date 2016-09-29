// @flow
import {createStore} from 'redux'
export default (f: Function) => f(createStore)
