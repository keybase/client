import * as Impl from './index-impl'

const getEngine: any = Impl.getEngine
const makeEngine: any = Impl.makeEngine
const Engine: any = Impl.Engine

export default Impl.default as any
export {getEngine, makeEngine, Engine}
