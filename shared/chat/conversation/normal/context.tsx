import * as React from 'react'
import {useComposer} from '../input-area/composer'

type ScrollType = {
  scrollUp: () => void
  scrollDown: () => void
  scrollToBottom: () => void
}
type ScrollRefType = null | ScrollType

type ThreadRefsType = ScrollType & {
  focusInput: () => void
  setScrollRef: (scrollRef: ScrollRefType) => void
}

export const ThreadRefsContext = React.createContext<ThreadRefsType>({
  focusInput: () => {},
  scrollDown: () => {},
  scrollToBottom: () => {},
  scrollUp: () => {},
  setScrollRef: () => {},
})
ThreadRefsContext.displayName = 'ThreadRefsContext'

export const ThreadRefsProvider = function ThreadRefsProvider({children}: {children: React.ReactNode}) {
  const composer = useComposer()
  const scrollRef = React.useRef<ScrollRefType>(null)
  const [value] = React.useState<ThreadRefsType>(() => ({
    focusInput: () => {
      composer.focus()
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
    setScrollRef: r => {
      scrollRef.current = r
    },
  }))
  return <ThreadRefsContext value={value}>{children}</ThreadRefsContext>
}
