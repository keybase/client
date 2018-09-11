// @noflow
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}
class Engine {}
class EngineChannel {}
const makeEngine = () => null
const getEngine = () => null
export default getEngine
export {getEngine, makeEngine, Engine, EngineChannel}
