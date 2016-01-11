import getenv from 'getenv'

export function updateConfig (config) {
  let newConfig = {...config}

  if (getenv.bool('KEYBASE_APP_DEBUG', false)) {
    newConfig.showMainWindow = true
  }

  if (getenv.bool('KEYBASE_SHOW_DEVTOOLS', false)) {
    newConfig.showDevTools = true
  }

  return newConfig
}
