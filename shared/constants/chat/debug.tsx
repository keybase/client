// Debug utilities for chat
import {debugWarning} from '@/util/debug-warning'

export const chatDebugEnabled = false as boolean

if (chatDebugEnabled) {
  debugWarning('Debug chat enabled!')
}
