// Debug overlays the app draws over every screen from its config store: the global error bar (an
// error the app could not handle) and the runtime stats the service sends while they are turned on.
// Both are set in the store directly; a reload puts the store back.
//
// The service's disconnect overlay (the daemon store's error) is left out: its illustration is an
// animation that never settles.
import type * as T from '@/constants/types'
import type {FixtureDef, StoreApi} from './def.ts'

type ConfigState = {globalError?: Error; runtimeStats?: T.RPCGen.RuntimeStats}
const setConfig = (config: StoreApi | undefined, change: Partial<ConfigState>) => {
  if (!config) throw new Error('the config store is not in __ZUSTAND_HMR__; is this a dev build?')
  config.setState({...(config.getState() as ConfigState), ...change}, true)
}

// The bar shows the message, and its details (shown expanded) the stack, which is set so it holds
// no bundle paths.
const fixtureError = () => {
  const e = new Error('The visual gate set this error.')
  e.stack = 'Error: The visual gate set this error.\n    at the visual gate fixture'
  return e
}

export const globalError: FixtureDef = {
  beforeNav: s => setConfig(s.get('z:config'), {globalError: fixtureError()}),
  rpc: [],
  stores: ['z:config'],
  teardown: 'reload',
}

const process = (type: T.RPCGen.ProcessType, severity: T.RPCGen.StatsSeverityLevel): T.RPCGen.ProcessRuntimeStats => ({
  cpu: '12.50%',
  cpuSeverity: severity,
  free: '1.20GB',
  goheap: '80.00MB',
  goheapsys: '120.00MB',
  goreleased: '10.00MB',
  resident: '210.00MB',
  residentSeverity: 0,
  type,
  virt: '4.10GB',
})

export const runtimeStats: FixtureDef = {
  beforeNav: s =>
    setConfig(s.get('z:config'), {
      runtimeStats: {
        convLoaderActive: true,
        dbStats: [
          {memCompActive: true, tableCompActive: false, type: 1},
          {memCompActive: false, tableCompActive: false, type: 2},
        ],
        perfEvents: null,
        processStats: [process(0, 1), process(1, 0)],
        selectiveSyncActive: false,
      },
    }),
  rpc: [],
  stores: ['z:config'],
  teardown: 'reload',
}
