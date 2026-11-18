import * as Chat from '@/constants/chat'
import * as Common from '@/router-v2/common'
import inboxOptions from '@/chat/inbox/get-options'
import {mobileSplitOptions} from '@/chat/inbox-and-conversation-get-options'

// An iPhone's chat tab root header, for the inbox alone or the split view (see phone-chat-root).
// Each set names every key the other sets, so switching between them leaves nothing behind.
const defaults = Common.defaultNavigationOptions as {
  headerBackgroundContainerStyle?: object
  headerLeftContainerStyle?: object
  headerRightContainerStyle?: object
  headerStyle?: object
  headerTitleContainerStyle?: object
}
export const narrowOptions = {
  ...inboxOptions,
  headerBackgroundContainerStyle: defaults.headerBackgroundContainerStyle,
  headerLeftContainerStyle: defaults.headerLeftContainerStyle,
  headerRightContainerStyle: defaults.headerRightContainerStyle,
  headerStyle: defaults.headerStyle,
  headerTitleContainerStyle: defaults.headerTitleContainerStyle,
}
export const splitOptions = {
  ...mobileSplitOptions,
  // the split header draws the account switcher and the new chat button itself
  unstable_headerLeftItems: undefined,
  unstable_headerRightItems: undefined,
}

export const phoneChatRootOptions = () => (Chat.isChatSplit() ? splitOptions : narrowOptions)
