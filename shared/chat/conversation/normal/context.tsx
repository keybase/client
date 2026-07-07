import * as React from 'react'

type FocusRefType = null | {focus: () => void}

type ScrollType = {
  scrollUp: () => void
  scrollDown: () => void
  scrollToBottom: () => void
}
type ScrollRefType = null | ScrollType

type ThreadRefsType = ScrollType & {
  focusInput: () => void
  setInputRef: (inputRef: FocusRefType) => void
  setScrollRef: (scrollRef: ScrollRefType) => void
}

export const ThreadRefsContext = React.createContext<ThreadRefsType>({
  focusInput: () => {},
  scrollDown: () => {},
  scrollToBottom: () => {},
  scrollUp: () => {},
  setInputRef: () => {},
  setScrollRef: () => {},
})
ThreadRefsContext.displayName = 'ThreadRefsContext'

export const ThreadRefsProvider = function ThreadRefsProvider({children}: {children: React.ReactNode}) {
  const inputRef = React.useRef<FocusRefType>(null)
  const scrollRef = React.useRef<ScrollRefType>(null)
  const [value] = React.useState<ThreadRefsType>(() => ({
    focusInput: () => {
      inputRef.current?.focus()
    },
    scrollDown: () => {
      scrollRef.current?.scrollDown()
    },
    scrollToBottom: () => {
      scrollRef.current?.scrollToBottom()
    },
    scrollUp: () => {
      scrollRef.current?.scrollUp()
    },
    setInputRef: r => {
      inputRef.current = r
    },
    setScrollRef: r => {
      scrollRef.current = r
    },
  }))
  return <ThreadRefsContext value={value}>{children}</ThreadRefsContext>
}
