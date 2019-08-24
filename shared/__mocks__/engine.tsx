console.error('mock engine loaded')
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}
class Engine {}
class EngineChannel {}
const mockEngine = {
  _rpcOutgoing: () => {},
}
const makeEngine = () => mockEngine
const getEngine = () => mockEngine
const getEngineSaga = () => {}
export default getEngine
export {getEngine, makeEngine, Engine, EngineChannel, getEngineSaga}
