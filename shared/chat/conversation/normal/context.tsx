import * as React from 'react'

type FocusRefType = null | {focus: () => void}

type FocusContextType = {
  focusInput: () => void
  setInputRef: (inputRef: FocusRefType) => void
}

export const FocusContext = React.createContext<FocusContextType>({
  focusInput: () => {},
  setInputRef: () => {},
})
FocusContext.displayName = 'FocusContext'

export const FocusProvider = function FocusProvider({children}: {children: React.ReactNode}) {
  const inputRef = React.useRef<FocusRefType>(null)
  const [value] = React.useState<FocusContextType>(() => ({
    focusInput: () => {
      inputRef.current?.focus()
    },
    setInputRef: r => {
      inputRef.current = r
    },
  }))
  return <FocusContext value={value}>{children}</FocusContext>
}

type ScrollType = {
  scrollUp: () => void
  scrollDown: () => void
  scrollToBottom: () => void
}
type ScrollRefType = null | ScrollType

type ScrollContextType = ScrollType & {
  setScrollRef: (scrollRef: ScrollRefType) => void
}

export const ScrollContext = React.createContext<ScrollContextType>({
  scrollDown: () => {},
  scrollToBottom: () => {},
  scrollUp: () => {},
  setScrollRef: () => {},
})
ScrollContext.displayName = 'ScrollContext'

export const ScrollProvider = function ScrollProvider({children}: {children: React.ReactNode}) {
  const scrollRef = React.useRef<ScrollRefType>(null)
  const [value] = React.useState<ScrollContextType>(() => ({
    scrollDown: () => {
      scrollRef.current?.scrollDown()
    },
    scrollToBottom: () => {
      scrollRef.current?.scrollToBottom()
    },
    scrollUp: () => {
      scrollRef.current?.scrollUp()
    },
    setScrollRef: r => {
      scrollRef.current = r
    },
  }))
  return <ScrollContext value={value}>{children}</ScrollContext>
}
