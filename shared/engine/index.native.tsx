import * as Impl from './index-impl'

const getEngine = Impl.getEngine
const makeEngine = Impl.makeEngine
const Engine = Impl.Engine

export default Impl.default as any
export {getEngine, makeEngine, Engine}
