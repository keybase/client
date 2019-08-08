import {useState} from 'react'

type Handler = () => void

export const useFocus = (start: boolean): [boolean, Handler, Handler] => {
  const [focused, setFocused] = useState(start)
  const onFocus = () => setFocused(true)
  // delaying blur is a workaround for the input blurring then focusing when switching tabs
  const onBlur = () => setTimeout(() => setFocused(false), 100)
  return [focused, onFocus, onBlur]
}
