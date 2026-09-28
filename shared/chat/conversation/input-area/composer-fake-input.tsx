// Test-only third input for the composer, next to the desktop textarea and the native TextInput.
// It applies writes and echoes reflected ones synchronously, the way the native input does.
import * as React from 'react'
import {useComposerInput, type ComposerInput} from './composer'
import type {Selection} from './normal/input.shared'

export type FakeComposerInput = ComposerInput & {
  // where the input reports what was typed; the real inputs call their onChangeText prop
  connect: (onChangeText: ((text: string) => void) | undefined) => void
  focusCount: number
  focused: boolean
  selection: Selection | undefined
  // false: like the native input, a write that is not reflected is not shown
  showsPreviews: boolean
  text: string
  // what a keystroke or paste does: new text, the caret, then the change report
  type: (text: string, caret?: number) => void
}

export const makeFakeComposerInput = (): FakeComposerInput => {
  let onChangeText: ((text: string) => void) | undefined
  const fake: FakeComposerInput = {
    clear: () => {
      fake.text = ''
      fake.selection = undefined
      onChangeText?.('')
    },
    connect: next => {
      onChangeText = next
    },
    focus: () => {
      fake.focusCount++
      fake.focused = true
    },
    focusCount: 0,
    focused: false,
    getSelection: () => fake.selection,
    isFocused: () => fake.focused,
    replaceText: (info, reflectChange) => {
      if (!reflectChange && !fake.showsPreviews) return false
      fake.text = info.text
      fake.selection = info.selection
      if (reflectChange) {
        onChangeText?.(info.text)
      }
      return true
    },
    selection: undefined,
    showsPreviews: true,
    text: '',
    type: (text, caret = text.length) => {
      fake.text = text
      fake.selection = {end: caret, start: caret}
      onChangeText?.(text)
    },
  }
  return fake
}

// Mounts a fake input on the conversation's composer the way the real composer mounts its input.
export const FakeComposerInputView = (p: {draft?: string; fake: FakeComposerInput}) => {
  const {draft, fake} = p
  const {setInput, textChanged} = useComposerInput<FakeComposerInput>(draft)
  React.useImperativeHandle(
    setInput,
    () => {
      fake.connect(textChanged)
      return fake
    },
    [fake, textChanged]
  )
  return null
}
