import fs from 'fs'
import {serverConfigFileName, jsonDebugFileName} from '@/constants/platform.desktop'
const getConfigOverload = () => {
  let config: {[key: string]: unknown} = {}
  // Load overrides from server config
  if (fs.existsSync(serverConfigFileName)) {
    try {
      const serverConfig = JSON.parse(fs.readFileSync(serverConfigFileName, 'utf8')) as
        | {[key: string]: unknown}
        | undefined

      const lastLoggedInUser = serverConfig?.['lastLoggedInUser']
      if (typeof lastLoggedInUser === 'string') {
        if (lastLoggedInUser) {
          const userConfig = serverConfig[lastLoggedInUser] as {printRPCStats?: boolean} | undefined
          if (userConfig?.printRPCStats) {
            config['printRPCStats'] = true
          }
        }
      }
    } catch {
      console.warn('Invalid server config')
    }
  }

  // Load overrides from a local json file
  if (fs.existsSync(jsonDebugFileName)) {
    try {
      const pathJson = JSON.parse(fs.readFileSync(jsonDebugFileName, 'utf8')) as {[key: string]: unknown}
      console.log('Loaded', jsonDebugFileName, pathJson)
      config = {...config, ...pathJson}
    } catch {
      console.warn(
        'Invalid local-debug file, parsing error <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<'
      )
    }
  }
  return config
}

export const configOverload = getConfigOverload()
