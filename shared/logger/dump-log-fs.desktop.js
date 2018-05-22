// @flow
import * as SafeElectron from '../util/safe-electron.desktop'
import logger from '.'
import {writeLogLinesToFile} from '../util/forward-logs'
import Logger from '../logger'

const dumpLogs = () =>
  logger.dump().then(fromRender => {
    // $ForceType
    const globalLogger: typeof Logger = SafeElectron.getRemote().getGlobal('globalLogger')
    return globalLogger.dump().then(fromMain => writeLogLinesToFile([...fromRender, ...fromMain]))
  })

export default dumpLogs
