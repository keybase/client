import type {GetOptionsRet} from '@/constants/types/router'
import type * as T from '@/constants/types'

declare function headerNavigationOptions(route: {
  params?: {conversationIDKey?: T.Chat.ConversationIDKey}
}): Partial<GetOptionsRet>
export {headerNavigationOptions}
