// @noflow
/* eslint-env jest */
import getEngine from '.'
import engineSaga from '../saga'

const initEngine = () => {}
const initEngineSaga = () => {}
const getEngineSaga = () => engineSaga

export {initEngine, getEngine, initEngineSaga, getEngineSaga}
