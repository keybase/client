import * as React from 'react'

export const FocusContext = React.createContext<{
  focusInput: () => void
  inputRef: React.MutableRefObject<null | {focus: () => void}>
}>({
  focusInput: () => {},
  inputRef: {current: null},
})

export const FocusProvider = React.memo(function FocusProvider({children}: {children: React.ReactNode}) {
  const inputRef = React.useRef<null | {focus: () => void}>(null)

  const focusInput = React.useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const value = React.useMemo(() => ({focusInput, inputRef}), [focusInput])

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
})

export const ScrollContext = React.createContext<{
  scrollUp: () => void
  scrollDown: () => void
  scrollToBottom: () => void
  scrollRef: React.MutableRefObject<null | {
    scrollUp: () => void
    scrollDown: () => void
    scrollToBottom: () => void
  }>
}>({
  scrollDown: () => {},
  scrollRef: {current: null},
  scrollToBottom: () => {},
  scrollUp: () => {},
})

export const ScrollProvider = React.memo(function FocusProvider({children}: {children: React.ReactNode}) {
  const scrollRef = React.useRef<null | {
    scrollUp: () => void
    scrollDown: () => void
    scrollToBottom: () => void
  }>(null)

  const scrollUp = React.useCallback(() => {
    scrollRef.current?.scrollUp()
  }, [])
  const scrollDown = React.useCallback(() => {
    scrollRef.current?.scrollDown()
  }, [])
  const scrollToBottom = React.useCallback(() => {
    scrollRef.current?.scrollToBottom()
  }, [])

  const value = React.useMemo(
    () => ({
      scrollDown,
      scrollRef,
      scrollToBottom,
      scrollUp,
    }),
    [scrollDown, scrollToBottom, scrollUp]
  )

  return <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>
})
