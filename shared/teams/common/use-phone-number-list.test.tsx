/** @jest-environment jsdom */
/// <reference types="jest" />
import {expect, test, describe} from '@jest/globals'
import {act, renderHook} from '@testing-library/react'
import {usePhoneNumberList} from './use-phone-number-list'

describe('usePhoneNumberList', () => {
  test('starts with one blank invalid row', () => {
    const {result} = renderHook(() => usePhoneNumberList())
    expect(result.current.phoneNumbers).toEqual([{key: 0, phoneNumber: '', valid: false}])
  })

  test('setting a number only touches the row at that index', () => {
    const {result} = renderHook(() => usePhoneNumberList())
    act(() => result.current.addPhoneNumber())
    act(() => result.current.setPhoneNumber(1, '+15551212', true))

    expect(result.current.phoneNumbers).toEqual([
      {key: 0, phoneNumber: '', valid: false},
      {key: 1, phoneNumber: '+15551212', valid: true},
    ])
  })

  test('setting an out of range index changes nothing', () => {
    const {result} = renderHook(() => usePhoneNumberList())
    act(() => result.current.setPhoneNumber(5, '+15551212', true))
    expect(result.current.phoneNumbers).toEqual([{key: 0, phoneNumber: '', valid: false}])
  })

  test('new rows take the next key after the last one, so a middle removal never collides', () => {
    const {result} = renderHook(() => usePhoneNumberList())
    act(() => result.current.addPhoneNumber())
    act(() => result.current.addPhoneNumber())
    expect(result.current.phoneNumbers.map(p => p.key)).toEqual([0, 1, 2])

    act(() => result.current.removePhoneNumber(1))
    act(() => result.current.addPhoneNumber())
    expect(result.current.phoneNumbers.map(p => p.key)).toEqual([0, 2, 3])
    expect(new Set(result.current.phoneNumbers.map(p => p.key)).size).toBe(3)
  })

  test('removing from the middle keeps the remaining rows and their values', () => {
    const {result} = renderHook(() => usePhoneNumberList())
    act(() => result.current.addPhoneNumber())
    act(() => result.current.addPhoneNumber())
    act(() => result.current.setPhoneNumber(0, 'a', true))
    act(() => result.current.setPhoneNumber(1, 'b', true))
    act(() => result.current.setPhoneNumber(2, 'c', false))

    act(() => result.current.removePhoneNumber(1))
    expect(result.current.phoneNumbers).toEqual([
      {key: 0, phoneNumber: 'a', valid: true},
      {key: 2, phoneNumber: 'c', valid: false},
    ])
  })

  test('reset goes back to a single blank row with a fresh key sequence', () => {
    const {result} = renderHook(() => usePhoneNumberList())
    act(() => result.current.addPhoneNumber())
    act(() => result.current.setPhoneNumber(0, '+15551212', true))

    act(() => result.current.resetPhoneNumbers())
    expect(result.current.phoneNumbers).toEqual([{key: 0, phoneNumber: '', valid: false}])

    act(() => result.current.addPhoneNumber())
    expect(result.current.phoneNumbers.map(p => p.key)).toEqual([0, 1])
  })

  // add-phone.tsx only offers the clear button when there is more than one row, so
  // the hook itself is free to empty the list; it just has to stay usable if it does
  test('emptying the list is survivable - the next add still yields one fresh blank row', () => {
    const {result} = renderHook(() => usePhoneNumberList())
    act(() => result.current.removePhoneNumber(0))
    expect(result.current.phoneNumbers).toEqual([])

    act(() => result.current.addPhoneNumber())
    expect(result.current.phoneNumbers).toHaveLength(1)
    expect(result.current.phoneNumbers[0]).toMatchObject({phoneNumber: '', valid: false})
  })
})
