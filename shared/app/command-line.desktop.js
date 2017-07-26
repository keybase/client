// @flow
import getenv from 'getenv'

export function updateConfig(config: any) {
  let newConfig = {...config}

  if (getenv.boolish('KEYBASE_SHOW_DEVTOOLS', false)) {
    newConfig.showDevTools = true
  }

  if (getenv.boolish('KEYBASE_REACT_PERF_STARTUP', false)) {
    newConfig.reactPerf = true
  }

  return newConfig
}
