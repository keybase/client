import {writeStream, readFile} from '../util/file'
import {serverConfigFileName} from '../constants/platform'
import logger from '../logger'

/** TODO deprecate and move to go */
export async function updateServerConfigLastLoggedIn(username: string, serverConfig: Object) {
  if (!username) {
    return
  }

  const oldConfig = await getServerConfig()

  try {
    const data = JSON.stringify({
      ...oldConfig,
      lastLoggedInUser: username,
      [username]: serverConfig,
    })
    const ws = await writeStream(serverConfigFileName, 'utf8')
    ws.write(data)
    ws.close()
  } catch (e) {
    logger.info('updateServerConfigLastLoggedIn fail writing new', e)
  }
}

export async function getServerConfig() {
  try {
    const old = await readFile(serverConfigFileName, 'utf8')
    return JSON.parse(old)
  } catch (e) {
    logger.info('updateServerConfigLastLoggedIn fail reading old', e)
  }

  return {}
}
