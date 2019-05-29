import logger from '../../logger'
import {commonLogLevel, Text as KBText, LogLevel} from '../../constants/types/rpc-gen'
import {NotifyPopup} from '../notifications'

export function log({text, level}: {readonly text: KBText; readonly level: LogLevel}): void {
  logger.info('keybase.1.logUi.log:', text.data)
  if (level >= commonLogLevel.error) {
    NotifyPopup(text.data, {})
  }
}
