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

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const value = React.useMemo(() => ({focusInput, inputRef}), [])

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
})
