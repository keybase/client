/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {cleanup, fireEvent, render} from '@testing-library/react'
import {Input} from './input'
import type {RefType} from './input.shared'

// input.tsx pulls in the native-only halves of the input bar at module scope;
// none of them are involved in the desktop caret path under test
jest.mock('@/chat/audio/audio-recorder.native', () => ({__esModule: true, default: () => null}))
jest.mock('@/chat/audio/audio-send.native', () => ({AudioSendWrapper: () => null}))
jest.mock('@/util/expo-document-picker.native', () => ({pickDocumentsAsync: jest.fn()}))

afterEach(() => {
  cleanup()
})

const renderInput = () => {
  const ref = React.createRef<RefType>()
  const onChangeText = jest.fn()
  const utils = render(<Input multiline={true} onChangeText={onChangeText} ref={ref} />)
  const input = utils.getByTestId(TestIDs.CHAT_INPUT)
  return {input, onChangeText, ref}
}

// the browser dispatches selectionchange (our onSelect) asynchronously, so a paste
// never updates the caret before the suggestors read it. the change event has to
// carry it instead, otherwise a pasted `!keybot cancel` looks like a caret at 0 and
// the suggestors match on the first word only
test('getSelection reflects the caret carried by the change event', () => {
  const {input, onChangeText, ref} = renderInput()

  fireEvent.change(input, {target: {selectionEnd: 14, selectionStart: 14, value: '!keybot cancel'}})

  expect(onChangeText).toHaveBeenLastCalledWith('!keybot cancel')
  expect(ref.current?.getSelection()).toEqual({end: 14, start: 14})
})

test('getSelection keeps a range selection from the change event', () => {
  const {input, ref} = renderInput()

  fireEvent.change(input, {target: {selectionEnd: 7, selectionStart: 1, value: '!keybot cancel'}})

  expect(ref.current?.getSelection()).toEqual({end: 7, start: 1})
})

// the composer writes waiting for an input as its ref is set, in the commit that may also bring
// a new onChangeText
test('a write made as the ref is set reaches the onChangeText of that render', () => {
  const first = jest.fn()
  const second = jest.fn()
  const setRef = (i: RefType | null) => {
    i?.replaceText({text: 'waiting'}, true)
  }
  const {rerender} = render(<Input multiline={false} onChangeText={first} ref={setRef} />)
  first.mockClear()

  rerender(<Input multiline={true} onChangeText={second} ref={setRef} />)

  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledWith('waiting')
})
