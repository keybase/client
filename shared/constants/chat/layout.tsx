import {isMobile, isTablet} from '../platform'

// in split mode the root is the 'inbox'
export const isSplit = !isMobile || isTablet // Whether the inbox and conversation panels are visible side-by-side.
export const threadRouteName = isSplit ? 'chatRoot' : 'chatConversation'
