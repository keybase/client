// The overlay stack is a desktop presentation; hot keys do nothing on mobile.
export const registerHotKeys = (_keys: ReadonlyArray<string>, _cb: (key: string) => void, _entry: string) => () => {}
