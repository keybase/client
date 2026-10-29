/** @jest-environment jsdom */
/// <reference types="jest" />
import {cleanup, fireEvent, render} from '@testing-library/react'
import {cropViewToRect, type CropView} from '@/util/crop'
import ZoomableImage from './zoomable-image'

// the toast reads the color scheme, which the test renderer lacks; it plays no part in the view
jest.mock('./toast', () => ({__esModule: true, default: () => null}))

afterEach(() => {
  cleanup()
})

test('a drag-pan image reports the view it opens on when it loads, before any pointer move', () => {
  const views: Array<CropView> = []
  const onLoaded = jest.fn()
  const {container} = render(
    <ZoomableImage src="/tmp/avatar.png" dragPan={true} onChanged={v => views.push(v)} onLoaded={onLoaded} />
  )
  const img = container.querySelector('img')
  if (!img) throw new Error('no img')
  img.getBoundingClientRect = () => ({height: 480, width: 640}) as DOMRect
  fireEvent.load(img)

  expect(onLoaded).toHaveBeenCalledTimes(1)
  expect(views).toHaveLength(1)
  const [view] = views
  if (!view) throw new Error('no view')
  expect(view).toMatchObject({height: 480, scale: 1, width: 640})
  // the untouched view is the window at the image's top-left corner
  expect(cropViewToRect(view, 300)).toEqual({x0: 0, x1: 300, y0: 0, y1: 300})
})

test('a new image opens on the default view, not the pan and zoom left from the one before', () => {
  const views: Array<CropView> = []
  const {container, rerender} = render(
    <ZoomableImage src="/tmp/a.png" dragPan={true} onChanged={v => views.push(v)} />
  )
  const root = container.firstElementChild as HTMLElement
  const img = container.querySelector('img')
  if (!img) throw new Error('no img')
  root.getBoundingClientRect = () => ({height: 300, left: 0, top: 0, width: 300}) as DOMRect
  img.getBoundingClientRect = () => ({height: 480, width: 640}) as DOMRect
  fireEvent.load(img)
  // image A panned to its bottom-right corner and zoomed
  fireEvent.wheel(root, {clientX: 300, clientY: 300, deltaY: 100})
  fireEvent.mouseMove(root, {clientX: 300, clientY: 300})
  const panned = views.at(-1)
  expect(panned?.scale).not.toBe(1)
  expect(panned?.x).not.toBe(0)

  // image B loads and is left untouched
  rerender(<ZoomableImage src="/tmp/b.png" dragPan={true} onChanged={v => views.push(v)} />)
  fireEvent.load(img)
  const view = views.at(-1)
  if (!view) throw new Error('no view')
  expect(view).toMatchObject({height: 480, scale: 1, width: 640, x: -0, y: -0})
  expect(cropViewToRect(view, 300)).toEqual({x0: 0, x1: 300, y0: 0, y1: 300})
  expect(img.style.transform).toBe('')
})

test('a zoom image without drag-pan reports no view on load', () => {
  const onChanged = jest.fn()
  const {container} = render(<ZoomableImage src="/tmp/a.png" onChanged={onChanged} />)
  const img = container.querySelector('img')
  if (!img) throw new Error('no img')
  fireEvent.load(img)
  expect(onChanged).not.toHaveBeenCalled()
})

test('a view smaller than the window crops the whole image', () => {
  expect(cropViewToRect({height: 100, scale: 2, width: 200, x: 0, y: 0}, 300)).toEqual({
    x0: 0,
    x1: 100,
    y0: 0,
    y1: 50,
  })
})
