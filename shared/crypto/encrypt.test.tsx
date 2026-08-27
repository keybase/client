/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import {
  type EncryptRouteParams,
  createEncryptState,
  encryptToOutputParams,
  teamBuilderResultToRecipients,
  useEncryptScreenState,
} from './encrypt'

beforeEach(() => {
  useCurrentUserState.setState({username: 'testuser'} as never)
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  useCurrentUserState.getState().dispatch.resetState()
})

test('createEncryptState defaults to signing and including yourself with no recipients', () => {
  const state = createEncryptState()
  expect(state.options).toEqual({includeSelf: true, sign: true})
  expect(state.meta).toEqual({hasRecipients: false, hasSBS: false, hideIncludeSelf: false})
  expect(state.recipients).toEqual([])
})

test('encryptToOutputParams flattens the meta/options the output screen reads', () => {
  const state = createEncryptState()
  state.meta.hasRecipients = true
  state.options.includeSelf = false
  state.recipients = ['testuser-mac']

  const params = encryptToOutputParams(state)
  expect(params.hasRecipients).toBe(true)
  expect(params.includeSelf).toBe(false)
  expect(params.recipients).toEqual(['testuser-mac'])
})

test('teamBuilderResultToRecipients formats non-keybase services as SBS assertions', () => {
  expect(
    teamBuilderResultToRecipients([
      {serviceId: 'keybase' as T.TB.ServiceIdWithContact, username: 'testuser'},
      {serviceId: 'twitter' as T.TB.ServiceIdWithContact, username: 'testuser-mac'},
      {serviceId: 'email' as T.TB.ServiceIdWithContact, username: 'testuser@example.com'},
    ])
  ).toEqual({
    hasSBS: true,
    recipients: ['testuser', 'testuser-mac@twitter', '[testuser@example.com]@email'],
  })
})

test('teamBuilderResultToRecipients reports no SBS when everyone is on keybase', () => {
  expect(
    teamBuilderResultToRecipients([
      {serviceId: 'keybase' as T.TB.ServiceIdWithContact, username: 'testuser'},
      {serviceId: 'keybase' as T.TB.ServiceIdWithContact, username: 'testuser-mac'},
    ])
  ).toEqual({hasSBS: false, recipients: ['testuser', 'testuser-mac']})
})

test('team builder results become recipients and hide include-self when you are one of them', () => {
  const {rerender, result} = renderHook(
    (props?: EncryptRouteParams) => useEncryptScreenState(props),
    {initialProps: undefined as EncryptRouteParams | undefined}
  )

  act(() => {
    rerender({
      teamBuilderNonce: 'nonce-1',
      teamBuilderUsers: [
        {serviceId: 'keybase' as T.TB.ServiceIdWithContact, username: 'testuser'},
        {serviceId: 'keybase' as T.TB.ServiceIdWithContact, username: 'testuser-mac'},
      ],
    })
  })

  expect(result.current.state.recipients).toEqual(['testuser', 'testuser-mac'])
  expect(result.current.state.meta).toEqual({
    hasRecipients: true,
    hasSBS: false,
    hideIncludeSelf: true,
  })
  // encrypting to yourself twice is redundant, so the option is forced off
  expect(result.current.state.options.includeSelf).toBe(false)
})

test('a non-keybase recipient forces sign + include-self back on', () => {
  const {rerender, result} = renderHook(
    (props?: EncryptRouteParams) => useEncryptScreenState(props),
    {initialProps: undefined as EncryptRouteParams | undefined}
  )

  act(() => {
    result.current.setEncryptOptions({includeSelf: false, sign: false})
  })
  expect(result.current.state.options).toEqual({includeSelf: false, sign: false})

  act(() => {
    rerender({
      teamBuilderNonce: 'nonce-1',
      teamBuilderUsers: [
        {serviceId: 'keybase' as T.TB.ServiceIdWithContact, username: 'testuser-mac'},
        {serviceId: 'twitter' as T.TB.ServiceIdWithContact, username: 'testuser-mac'},
      ],
    })
  })

  expect(result.current.state.recipients).toEqual(['testuser-mac', 'testuser-mac@twitter'])
  expect(result.current.state.meta).toEqual({hasRecipients: true, hasSBS: true, hideIncludeSelf: false})
  expect(result.current.state.options).toEqual({includeSelf: true, sign: true})
})

test('the same team builder nonce is only applied once', () => {
  const {rerender, result} = renderHook(
    (props?: EncryptRouteParams) => useEncryptScreenState(props),
    {initialProps: undefined as EncryptRouteParams | undefined}
  )

  const params = {
    teamBuilderNonce: 'nonce-1',
    teamBuilderUsers: [{serviceId: 'keybase' as T.TB.ServiceIdWithContact, username: 'testuser-mac'}],
  }
  act(() => {
    rerender(params)
  })
  act(() => {
    result.current.clearRecipients()
  })
  act(() => {
    rerender({...params, teamBuilderUsers: [...params.teamBuilderUsers]})
  })

  // re-running the same nonce would resurrect recipients the user just cleared
  expect(result.current.state.recipients).toEqual([])
})

test('encrypting an unresolved SBS recipient surfaces the wait-for-them warning', async () => {
  jest
    .spyOn(T.RPCGen, 'saltpackSaltpackEncryptStringRpcPromise')
    .mockImplementation(async () =>
      Promise.resolve({
        ciphertext: 'cipher',
        unresolvedSBSAssertion: 'testuser-mac@twitter',
        usedUnresolvedSBS: true,
      } as never)
    )

  const {result} = renderHook(() => useEncryptScreenState())
  act(() => {
    result.current.setInput('text', 'hello')
  })

  await waitFor(() => expect(result.current.state.warningMessage).toContain('testuser-mac@twitter'))
  expect(result.current.state.warningMessage).toContain('not yet a Keybase user')
  expect(result.current.state.outputStatus).toBe('success')
  expect(result.current.state.errorMessage).toBe('')
})

test('encrypt with no recipients falls back to encrypting to yourself', async () => {
  const encryptSpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackEncryptStringRpcPromise')
    .mockImplementation(async () =>
      Promise.resolve({ciphertext: 'cipher', unresolvedSBSAssertion: '', usedUnresolvedSBS: false} as never)
    )

  const {result} = renderHook(() => useEncryptScreenState())
  act(() => {
    result.current.setInput('text', 'hello')
  })

  await waitFor(() => expect(encryptSpy).toHaveBeenCalled())
  expect(encryptSpy).toHaveBeenCalledWith(
    expect.objectContaining({opts: expect.objectContaining({recipients: ['testuser']})}),
    expect.anything()
  )
})

test('an unsigned encrypt does not attribute the output to a sender', async () => {
  jest
    .spyOn(T.RPCGen, 'saltpackSaltpackEncryptStringRpcPromise')
    .mockImplementation(async () =>
      Promise.resolve({ciphertext: 'cipher', unresolvedSBSAssertion: '', usedUnresolvedSBS: false} as never)
    )

  const {result} = renderHook(() => useEncryptScreenState())
  act(() => {
    result.current.setEncryptOptions({sign: false})
  })
  act(() => {
    result.current.setInput('text', 'hello')
  })

  await waitFor(() => expect(result.current.state.outputStatus).toBe('success'))
  expect(result.current.state.outputSigned).toBe(false)
  expect(result.current.state.outputSenderUsername).toBeUndefined()
})

test('clearInput wipes the input and marks the empty output valid', async () => {
  jest
    .spyOn(T.RPCGen, 'saltpackSaltpackEncryptStringRpcPromise')
    .mockImplementation(async () =>
      Promise.resolve({ciphertext: 'cipher', unresolvedSBSAssertion: '', usedUnresolvedSBS: false} as never)
    )

  const {result} = renderHook(() => useEncryptScreenState())
  act(() => {
    result.current.setInput('text', 'hello')
  })
  await waitFor(() => expect(result.current.state.output).toBe('cipher'))

  // setInput with an empty value routes through clearInput
  act(() => {
    result.current.setInput('text', '')
  })

  expect(result.current.state.input).toBe('')
  expect(result.current.state.output).toBe('')
  expect(result.current.state.outputValid).toBe(true)
})
