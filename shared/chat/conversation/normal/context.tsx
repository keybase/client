import * as React from 'react'

type FocusRefType = null | {focus: () => void}

export const FocusContext = React.createContext<{
  focusInput: () => void
  setInputRef: (inputRef: FocusRefType) => void
}>({focusInput: () => {}, setInputRef: () => {}})

export const FocusProvider = React.memo(function FocusProvider({children}: {children: React.ReactNode}) {
  const inputRef = React.useRef<FocusRefType>(null)
  const setInputRef = React.useCallback((r: FocusRefType) => {
    inputRef.current = r
  }, [])
  const focusInput = React.useCallback(() => {
    inputRef.current?.focus()
  }, [])
  const value = React.useMemo(() => ({focusInput, setInputRef}), [setInputRef, focusInput])
  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
})

type ScrollType = {
  scrollUp: () => void
  scrollDown: () => void
  scrollToBottom: () => void
}
type ScrollRefType = null | ScrollType
export const ScrollContext = React.createContext<
  ScrollType & {
    setScrollRef: (scrollRef: ScrollRefType) => void
  }
>({
  scrollDown: () => {},
  scrollToBottom: () => {},
  scrollUp: () => {},
  setScrollRef: () => {},
})

export const ScrollProvider = React.memo(function ScrollProvider({children}: {children: React.ReactNode}) {
  const [scrollRef, setScrollRef] = React.useState<ScrollRefType>(null)
  const scrollUp = React.useCallback(() => {
    scrollRef?.scrollUp()
  }, [scrollRef])
  const scrollDown = React.useCallback(() => {
    scrollRef?.scrollDown()
  }, [scrollRef])
  const scrollToBottom = React.useCallback(() => {
    scrollRef?.scrollToBottom()
  }, [scrollRef])
  const value = React.useMemo(
    () => ({scrollDown, scrollToBottom, scrollUp, setScrollRef}),
    [scrollDown, scrollToBottom, scrollUp, setScrollRef]
  )
  return <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>
})
