/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, render} from '@testing-library/react'
import CoinFlipResult from './results'

afterEach(cleanup)

const handsResult = (hands?: Array<T.RPCChat.UICoinFlipHand>): T.RPCChat.UICoinFlipResult =>
  ({hands, typ: T.RPCChat.UICoinFlipResultTyp.hands}) as T.RPCChat.UICoinFlipResult

describe('CoinFlipResult hands', () => {
  // an empty list is not "some hands with nothing in them", it is no result at all
  test('renders nothing without any hands', () => {
    expect(render(<CoinFlipResult result={handsResult([])} />).container.innerHTML).toBe('')
    expect(render(<CoinFlipResult result={handsResult(undefined)} />).container.innerHTML).toBe('')
  })

  test('renders the targets that got no cards', () => {
    const {container} = render(<CoinFlipResult result={handsResult([{target: 'testuser'}])} />)
    expect(container.innerHTML).not.toBe('')
    expect(container.textContent).toContain('testuser')
  })
})
