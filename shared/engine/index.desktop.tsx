import KB2 from '../util/electron.desktop'
import type {TypedState, TypedDispatch} from '../util/container'

const {getEngineProxy} = KB2.functions
if (!getEngineProxy) {
  throw new Error('Impossible')
}

const engineProxy = getEngineProxy()

export const getEngine = () => engineProxy.getEngine()
export const makeEngine = (dispatch: TypedDispatch, getState: () => TypedState) =>
  engineProxy.makeEngine(dispatch, getState)

// const getEngine = Impl.getEngine
// const makeEngine = Impl.makeEngine
// const Engine = Impl.Engine

// export default Impl.default as any
// export {getEngine, makeEngine, Engine}
