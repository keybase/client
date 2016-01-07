import getenv from 'getenv'

export function updateConfig (config) {
  let newConfig = {...config}

  if (getenv.bool('KEYBASE_APP_DEBUG', false)) {
    newConfig.showDevTools = true
    newConfig.showMainWindow = true
  }

  return newConfig
}
