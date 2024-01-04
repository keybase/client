import * as React from 'react'

type FocusRefType = null | {focus: () => void}

export const FocusContext = React.createContext<{
  focusInput: () => void
  inputRef: React.MutableRefObject<FocusRefType>
}>({focusInput: () => {}, inputRef: {current: null}})

export const FocusProvider = React.memo(function FocusProvider({children}: {children: React.ReactNode}) {
  const inputRef = React.useRef<FocusRefType>(null)
  const focusInput = React.useCallback(() => {
    inputRef.current?.focus()
  }, [])
  const value = React.useMemo(() => ({focusInput, inputRef}), [focusInput])
  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
})

type ScrollType = {
  scrollUp: () => void
  scrollDown: () => void
  scrollToBottom: () => void
}
type ScrollRefType = null | ScrollType
export const ScrollContext = React.createContext<
  ScrollType & {scrollRef: React.MutableRefObject<ScrollRefType>}
>({
  scrollDown: () => {},
  scrollRef: {current: null},
  scrollToBottom: () => {},
  scrollUp: () => {},
})

export const ScrollProvider = React.memo(function ScrollProvider({children}: {children: React.ReactNode}) {
  const scrollRef = React.useRef<ScrollRefType>(null)
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
    () => ({scrollDown, scrollRef, scrollToBottom, scrollUp}),
    [scrollDown, scrollToBottom, scrollUp]
  )
  return <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>
})
