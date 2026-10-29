/** @jest-environment jsdom */
/// <reference types="jest" />
import {cleanup, fireEvent, render} from '@testing-library/react'
import {Box2} from './box'

afterEach(() => {
  cleanup()
})

test('the desktop Box2 hands every mouse handler it declares to its element', () => {
  const calls: Array<string> = []
  const {getByTestId} = render(
    <Box2
      direction="vertical"
      testID="box"
      onMouseDown={() => calls.push('down')}
      onMouseEnter={() => calls.push('enter')}
      onMouseLeave={() => calls.push('leave')}
      onMouseMove={() => calls.push('move')}
      onMouseOver={() => calls.push('over')}
      onMouseUp={() => calls.push('up')}
    />
  )
  const box = getByTestId('box')
  fireEvent.mouseEnter(box)
  fireEvent.mouseOver(box)
  fireEvent.mouseMove(box)
  fireEvent.mouseDown(box)
  fireEvent.mouseUp(box)
  fireEvent.mouseLeave(box)
  // React derives enter and leave from over and out, so only which handlers ran is compared
  expect(new Set(calls)).toEqual(new Set(['enter', 'over', 'move', 'down', 'up', 'leave']))
})
