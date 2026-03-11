import * as React from 'react'

type FocusRefType = null | {focus: () => void}

export const FocusContext = React.createContext<{
  focusInput: () => void
  setInputRef: (inputRef: FocusRefType) => void
}>({focusInput: () => {}, setInputRef: () => {}})

export const FocusProvider = function FocusProvider({children}: {children: React.ReactNode}) {
  const inputRef = React.useRef<FocusRefType>(null)
  const setInputRef = (r: FocusRefType) => {
    inputRef.current = r
  }
  const focusInput = () => {
    inputRef.current?.focus()
  }
  const value = {focusInput, setInputRef}
  return <FocusContext value={value}>{children}</FocusContext>
}

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

export const ScrollProvider = function ScrollProvider({children}: {children: React.ReactNode}) {
  const scrollRef = React.useRef<ScrollRefType>(null)
  const setScrollRef = (r: ScrollRefType) => {
    scrollRef.current = r
  }
  const scrollUp = () => {
    scrollRef.current?.scrollUp()
  }
  const scrollDown = () => {
    scrollRef.current?.scrollDown()
  }
  const scrollToBottom = () => {
    scrollRef.current?.scrollToBottom()
  }
  const value = {scrollDown, scrollToBottom, scrollUp, setScrollRef}
  return <ScrollContext value={value}>{children}</ScrollContext>
}
