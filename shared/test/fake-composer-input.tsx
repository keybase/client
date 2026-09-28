// Test-only third input for the composer, next to the desktop textarea and the native TextInput.
// It applies writes and echoes reflected ones synchronously, the way the native input does.
import * as React from 'react'
import {useComposerInput, type ComposerInput, type makeComposer} from '@/chat/conversation/input-area/composer'
import type {Selection} from '@/chat/conversation/input-area/normal/input.shared'

export type FakeComposerInput = ComposerInput & {
  // where the input reports what was typed; the real inputs call their onChangeText prop
  connect: (onChangeText: ((text: string) => void) | undefined) => void
  focusCount: number
  focused: boolean
  selection: Selection | undefined
  // false: like the native input, a write that is not reflected is not shown
  showsPreviews: boolean
  text: string
  // true: insertTyped types into the text like a keystroke; false: it cannot, like the native input
  typesText: boolean
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
    insertTyped: s => {
      if (!fake.typesText) return false
      const start = fake.selection?.start ?? fake.text.length
      const end = fake.selection?.end ?? start
      fake.type(fake.text.slice(0, start) + s + fake.text.slice(end), start + s.length)
      return true
    },
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
    typesText: false,
  }
  return fake
}

// Mounts a fake input on the conversation's composer the way the real composer mounts its input.
export const FakeComposerInputView = (p: {
  children?: React.ReactElement
  draft?: string
  fake: FakeComposerInput
  readOnly?: boolean
}) => {
  const {children, draft, fake, readOnly = false} = p
  const {setInput, textChanged} = useComposerInput<FakeComposerInput>(draft, readOnly)
  React.useImperativeHandle(
    setInput,
    () => {
      fake.connect(textChanged)
      return fake
    },
    [fake, textChanged]
  )
  return children ?? null
}

// Records every input a view of the composers made from now on attaches (and null for every
// detach), by wrapping makeComposer; restored with the other mocks.
export const recordComposerAttaches = (composerModule: {makeComposer: typeof makeComposer}) => {
  const attaches: Array<ComposerInput | null> = []
  const actual = composerModule.makeComposer
  jest.spyOn(composerModule, 'makeComposer').mockImplementation(deps => {
    const composer = actual(deps)
    return {
      ...composer,
      connect: () => {
        const view = composer.connect()
        return {
          ...view,
          setInput: input => {
            attaches.push(input)
            view.setInput(input)
          },
        }
      },
    }
  })
  return attaches
}
