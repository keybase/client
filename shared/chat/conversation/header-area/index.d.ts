import type {GetOptionsRet} from '@/constants/types/router'

declare function headerNavigationOptions(route: {
  params: {conversationIDKey?: string}
}): Partial<GetOptionsRet>
export {headerNavigationOptions}
