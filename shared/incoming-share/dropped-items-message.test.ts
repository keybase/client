/// <reference types="jest" />
import {getDroppedItemsMessage} from './index'

test('nothing dropped says nothing', () => {
  expect(getDroppedItemsMessage(3, 0)).toBe('')
})

test('a partial failure counts the dropped items against the whole share', () => {
  expect(getDroppedItemsMessage(3, 2)).toBe("2 of 5 items couldn't be prepared.")
})

test('a share where every item failed says so instead of a generic error', () => {
  expect(getDroppedItemsMessage(0, 1)).toBe(
    "The shared item couldn't be prepared. Please try sharing it again."
  )
  expect(getDroppedItemsMessage(0, 4)).toBe(
    'None of the 4 shared items could be prepared. Please try sharing them again.'
  )
})
