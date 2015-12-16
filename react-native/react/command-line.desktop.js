export function updateConfig (config) {
  let newConfig = {...config}

  if (process.env.KEYBASE_APP_DEBUG === 'true') {
    newConfig.showDevTools = true
    newConfig.showMainWindow = true
  }

  return newConfig
}
