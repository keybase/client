import logger from '../../logger'
import {LogLevel, type Text as KBText} from '../../constants/types/rpc-gen'
import {NotifyPopup} from '../notifications'

export function log({text, level}: {readonly text: KBText; readonly level: LogLevel}): void {
  logger.info('keybase.1.logUi.log:', text.data)
  if (level >= LogLevel.error) {
    NotifyPopup(text.data, {})
  }
}
