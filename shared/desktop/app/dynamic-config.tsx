import fs from 'fs'
import {serverConfigFileName, jsonDebugFileName} from '../../constants/platform.desktop'
const getConfigOverload = () => {
  let config: any = {}
  // Load overrides from server config
  if (fs.existsSync(serverConfigFileName)) {
    try {
      const serverConfig = JSON.parse(fs.readFileSync(serverConfigFileName, 'utf8'))
      if (serverConfig.lastLoggedInUser) {
        const userConfig = serverConfig[serverConfig.lastLoggedInUser] || {}
        if (userConfig.printRPCStats) {
          config.printRPCStats = true
        }
      }
    } catch (e) {
      console.warn('Invalid server config')
    }
  }

  // Load overrides from a local json file
  if (fs.existsSync(jsonDebugFileName)) {
    try {
      const pathJson = JSON.parse(fs.readFileSync(jsonDebugFileName, 'utf8'))
      console.log('Loaded', jsonDebugFileName, pathJson)
      config = {...config, ...pathJson}
    } catch (e) {
      console.warn('Invalid local debug file')
    }
  }
  return config
}

export const configOverload = getConfigOverload()
export const allowMultipleInstances: boolean = configOverload?.allowMultipleInstances ?? __DEV__
export const showDevTools: boolean = configOverload?.showDevTools ?? __DEV__
export const skipSecondaryDevtools: boolean = configOverload?.skipSecondaryDevtools ?? __DEV__
