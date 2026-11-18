import inboxOptions from '@/chat/inbox/get-options'

// An iPhone's chat tab root header, for the inbox alone or the split view (see phone-chat-root).
//
// Split, the screen hides the bar and draws its own header: iOS gives a custom navigation bar title
// only the middle of the bar to receive touches in, so the account switcher and the conversation's
// buttons at either end of a full-width title were dead. routes.tsx asserts that no route hides its
// bar, because a push from a bar-less screen to a headered one on the same stack judders on iOS
// (react-native-screens#3773). That cannot happen here: a phone's chat tab stack holds only this
// screen, and everything it opens is pushed on the root stack above the tabs. So the routes keep the
// bar in their options and only this screen, while split, hides it.
export const narrowOptions = {...inboxOptions, headerShown: true}
export const splitOptions = {headerShown: false}
