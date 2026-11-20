// The debug overlay the app draws over every screen from its config store: the global error bar (an
// error the app could not handle). It is set in the store directly; a reload puts the store back.
//
// The service's disconnect overlay (the daemon store's error) is left out: its illustration is an
// animation that never settles.
import type {FixtureDef, StoreApi} from './def.ts'

type ConfigState = {
  globalError?: Error
  dispatch: {setGlobalError: (e?: unknown) => void}
}
const configOf = (config: StoreApi | undefined) => {
  if (!config) throw new Error('the config store is not in __ZUSTAND_HMR__; is this a dev build?')
  return config
}

// The bar shows the message, and its details (shown expanded) the stack, which is set so it holds
// no bundle paths.
const fixtureError = () => {
  const e = new Error('The visual gate set this error.')
  e.stack = 'Error: The visual gate set this error.\n    at the visual gate fixture'
  return e
}

// Desktop clears the error 10s after it shows (app/global-errors.tsx). While the fixture is active
// the store's setGlobalError ignores a clear, so the bar stays up however long the capture takes;
// end() puts the store's own dispatch back.
export const globalError: FixtureDef = {
  beforeNav: s => {
    const config = configOf(s.get('z:config'))
    const {dispatch} = config.getState() as ConfigState
    const setGlobalError = (e?: unknown) => {
      if (e) dispatch.setGlobalError(e)
    }
    config.setState({dispatch: {...dispatch, setGlobalError}, globalError: fixtureError()} satisfies Partial<ConfigState>)
  },
  rpc: [],
  stores: ['z:config'],
  teardown: 'reload',
}
