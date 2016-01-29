import getenv from 'getenv'

export function updateConfig (config) {
  let newConfig = {...config}

  if (getenv.boolish('KEYBASE_APP_DEBUG', false)) {
    newConfig.showMainWindow = true
  }

  if (getenv.boolish('KEYBASE_SHOW_DEVTOOLS', false)) {
    newConfig.showDevTools = true
  }

  return newConfig
}
