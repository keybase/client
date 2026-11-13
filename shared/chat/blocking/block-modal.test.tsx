/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render} from '@testing-library/react'
import * as NavTree from '@/constants/nav-tree'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {makeRootState, navigationWrapper, renders} from '@/test/navigation'
import BlockModal from './block-modal'

const getUserBlocks = 'keybase.1.user.getUserBlocks'
const setUserBlocks = 'keybase.1.user.setUserBlocks'
const reportUser = 'keybase.1.user.reportUser'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

let fake: FakeEngine

// The modal up over the thread, opened to block testuser-mac (as a profile's Block does), and to
// report them too when `report`
const renderModal = async (report = false) => {
  const params = {blockUserByDefault: true, reportsUserByDefault: report, username: 'testuser-mac'}
  const {wrapper, ...nav} = navigationWrapper({
    rootState: makeRootState({
      above: [{name: 'chatBlockingModal', params}],
      tabStack: [{name: 'chatRoot', params: {conversationIDKey}}],
    }),
    route: 'chatBlockingModal',
  })
  const rendered = render(<BlockModal {...params} />, {wrapper})
  const modals = () => NavTree.modalStack(nav.getRootState()).map(r => r.name)
  expect(modals()).toEqual(['chatBlockingModal'])
  // the modal's own load of testuser-mac's blocks has answered and Finish is shown
  await flush()
  await renders()
  expect(paramsOf(fake, getUserBlocks)).toEqual([{usernames: ['testuser-mac']}])
  rendered.getByText('Finish')
  return {...rendered, modals}
}

const clickFinish = async (getByText: (t: string) => HTMLElement) => {
  act(() => {
    fireEvent.click(getByText('Finish'))
  })
  await flush()
  await renders()
}

beforeEach(() => {
  fake = installFakeEngine()
  fake.answer(getUserBlocks, () => [{chatBlocked: false, followBlocked: false, username: 'testuser-mac'}])
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

// The engine sends a "waiting on" change at most every 500ms and a "waiting off" at once, so a
// block sent right after the modal's own load reaches the store with its on and off together.
test('Finish right after the modal loads blocks, and the modal closes once the block is saved', async () => {
  fake.answer(setUserBlocks, () => null)
  const r = await renderModal()

  await clickFinish(r.getByText)

  expect(paramsOf(fake, setUserBlocks)).toEqual([
    {blocks: [{setChatBlock: true, setFollowBlock: true, username: 'testuser-mac'}]},
  ])
  expect(r.modals()).toEqual([])
})

test('the modal stays up until the block and the report both answer', async () => {
  const heldBlocks = fake.hold(setUserBlocks)
  const heldReports = fake.hold(reportUser)
  const r = await renderModal(true)

  await clickFinish(r.getByText)
  expect(heldBlocks).toHaveLength(1)
  expect(heldReports).toHaveLength(1)

  heldBlocks[0]?.reply(null)
  await flush()
  await renders()
  expect(r.modals()).toEqual(['chatBlockingModal'])

  heldReports[0]?.reply(null)
  await flush()
  await renders()
  expect(r.modals()).toEqual([])
})

test('a failed block still closes the modal', async () => {
  fake.answer(setUserBlocks, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'block broke'))
  const r = await renderModal()

  await clickFinish(r.getByText)

  expect(paramsOf(fake, setUserBlocks)).toHaveLength(1)
  expect(r.modals()).toEqual([])
})
