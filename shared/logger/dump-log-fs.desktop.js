// @flow
import {remote} from 'electron'
import logger from '.'
import {writeLogLinesToFile} from '../util/forward-logs'

const dumpLogs = () =>
  logger.dump().then(fromRender =>
    remote
      .getGlobal('globalLogger')
      .dump()
      .then(fromMain => writeLogLinesToFile([...fromRender, ...fromMain]))
  )

export default dumpLogs
