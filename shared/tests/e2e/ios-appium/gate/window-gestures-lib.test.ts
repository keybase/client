import {type ActionSource, originElements, windowGestures} from './window-gestures-lib'

const touch = (...actions: ActionSource['actions']): ActionSource => ({actions, id: 'finger', parameters: {pointerType: 'touch'}, type: 'pointer'})
const none = new Map<string, {x: number; y: number}>()

describe('windowGestures', () => {
  test('a press and lift with no move is a tap where it went down', () => {
    expect(windowGestures([touch({type: 'pointerMove', x: 10, y: 20}, {type: 'pointerDown'}, {type: 'pointerUp'})], none)).toEqual([{at: {x: 10, y: 20}, kind: 'tap'}])
  })

  test('one held down half a second or more is a hold', () => {
    expect(
      windowGestures([touch({type: 'pointerMove', x: 10, y: 20}, {type: 'pointerDown'}, {duration: 800, type: 'pause'}, {type: 'pointerUp'})], none)
    ).toEqual([{at: {x: 10, y: 20}, kind: 'hold', seconds: 0.8}])
  })

  test("a drag goes from where it went down to where it lifted, past a pan's overshoot", () => {
    expect(
      windowGestures(
        [
          touch(
            {type: 'pointerMove', x: 100, y: 400},
            {type: 'pointerDown'},
            {duration: 300, type: 'pointerMove', x: 100, y: 120},
            {duration: 200, type: 'pointerMove', x: 100, y: 150},
            {duration: 200, type: 'pause'},
            {type: 'pointerUp'}
          ),
        ],
        none
      )
    ).toEqual([{from: {x: 100, y: 400}, kind: 'drag', press: 0.05, to: {x: 100, y: 150}}])
  })

  test('a pause before the first move is the press', () => {
    const g = windowGestures(
      [touch({type: 'pointerMove', x: 0, y: 0}, {type: 'pointerDown'}, {duration: 300, type: 'pause'}, {type: 'pointerMove', x: 0, y: 90}, {type: 'pointerUp'})],
      none
    )
    expect(g).toEqual([{from: {x: 0, y: 0}, kind: 'drag', press: 0.3, to: {x: 0, y: 90}}])
  })

  test("moves relative to the pointer, or to an element's middle, land in window points", () => {
    const el = {'element-6066-11e4-a52e-4f735466cecf': 'e1'}
    expect(originElements([touch({origin: el, type: 'pointerMove', x: 0, y: 0})])).toEqual(['e1'])
    expect(
      windowGestures(
        [touch({origin: el, type: 'pointerMove', x: 5, y: -5}, {type: 'pointerDown'}, {origin: 'pointer', type: 'pointerMove', x: 0, y: 50}, {type: 'pointerUp'})],
        new Map([['e1', {x: 200, y: 300}]])
      )
    ).toEqual([{from: {x: 205, y: 295}, kind: 'drag', press: 0.05, to: {x: 205, y: 345}}])
  })

  test('keys, two pointers, and a press never lifted go as written', () => {
    expect(windowGestures([{actions: [{type: 'keyDown'}], id: 'k', type: 'key'}], none)).toBeUndefined()
    const t = touch({type: 'pointerMove', x: 0, y: 0}, {type: 'pointerDown'}, {type: 'pointerUp'})
    expect(windowGestures([t, {...t, id: 'second'}], none)).toBeUndefined()
    expect(windowGestures([touch({type: 'pointerMove', x: 0, y: 0}, {type: 'pointerDown'})], none)).toBeUndefined()
  })
})
