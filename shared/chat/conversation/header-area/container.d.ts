import type {GetOptionsRet} from '@/constants/types/router2'

declare function headerNavigationOptions(route: {
  params: {conversationIDKey?: string}
}): Partial<GetOptionsRet>
export {headerNavigationOptions}
