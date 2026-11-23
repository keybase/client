// The route that shows an open chat thread on this run's form factor (KB_IOS_FORM_FACTOR): an iPhone
// Duo unfolded shows the inbox and the thread side by side, the thread as chatRoot's param; an iPhone,
// a folded Duo and a Split View half push it as chatConversation (constants/chat/layout.tsx).
export const threadRoute = () => (isDuoUnfolded() ? 'chatRoot' : 'chatConversation')

// Whether this run's form factor (KB_IOS_FORM_FACTOR) is an iPhone Duo unfolded.
export const isDuoUnfolded = () => process.env['KB_IOS_FORM_FACTOR'] === 'duo-unfolded'
