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

// jsdom lays nothing out: the container's and the image's sizes are set by hand
const sized = (container: HTMLElement, img: {height: number; width: number}) => {
  const root = container.firstElementChild as HTMLElement
  const el = container.querySelector('img')
  if (!el) throw new Error('no img')
  Object.defineProperty(root, 'clientWidth', {configurable: true, value: 300})
  Object.defineProperty(root, 'clientHeight', {configurable: true, value: 300})
  root.getBoundingClientRect = () => ({height: 300, left: 0, top: 0, width: 300}) as DOMRect
  Object.defineProperty(el, 'naturalWidth', {configurable: true, value: img.width})
  Object.defineProperty(el, 'naturalHeight', {configurable: true, value: img.height})
  return {el, root}
}

test('a drag-pan image opens filling the window, centered, and reports that view before any pointer move', () => {
  const views: Array<CropView> = []
  const onLoaded = jest.fn()
  const {container} = render(
    <ZoomableImage src="/tmp/avatar.png" dragPan={true} onChanged={v => views.push(v)} onLoaded={onLoaded} />
  )
  const {el} = sized(container, {height: 480, width: 640})
  fireEvent.load(el)

  expect(onLoaded).toHaveBeenCalledTimes(1)
  expect(views).toHaveLength(1)
  const [view] = views
  if (!view) throw new Error('no view')
  // the short side fills the window, and the long side overflows it equally on both ends
  expect(view).toMatchObject({height: 300, scale: 300 / 480, width: 400, x: 50, y: -0})
  expect(el.style.transform).toBe('translate(-50px, 0px) scale(0.625)')
  // the untouched view is the centered square of the image
  expect(cropViewToRect(view, 300)).toEqual({x0: 80, x1: 560, y0: 0, y1: 480})
})

test('a drag-pan image smaller than the window is scaled up to fill it', () => {
  const views: Array<CropView> = []
  const {container} = render(<ZoomableImage src="/tmp/small.png" dragPan={true} onChanged={v => views.push(v)} />)
  const {el} = sized(container, {height: 30, width: 60})
  fireEvent.load(el)
  const view = views.at(-1)
  if (!view) throw new Error('no view')
  expect(view).toMatchObject({height: 300, scale: 10, width: 600, x: 150, y: -0})
  expect(cropViewToRect(view, 300)).toEqual({x0: 15, x1: 45, y0: 0, y1: 30})
})

test('a new image opens on its default view, not the pan and zoom left from the one before', () => {
  const views: Array<CropView> = []
  const {container, rerender} = render(
    <ZoomableImage src="/tmp/a.png" dragPan={true} onChanged={v => views.push(v)} />
  )
  const {el, root} = sized(container, {height: 480, width: 640})
  fireEvent.load(el)
  const opened = views.at(-1)
  // image A panned to its bottom-right corner and zoomed
  fireEvent.wheel(root, {clientX: 300, clientY: 300, deltaY: 100})
  fireEvent.mouseMove(root, {clientX: 300, clientY: 300})
  const panned = views.at(-1)
  expect(panned?.scale).not.toBe(opened?.scale)
  expect(panned?.x).not.toBe(opened?.x)

  // image B loads and is left untouched
  rerender(<ZoomableImage src="/tmp/b.png" dragPan={true} onChanged={v => views.push(v)} />)
  fireEvent.load(el)
  expect(views.at(-1)).toEqual(opened)
  expect(el.style.transform).toBe('translate(-50px, 0px) scale(0.625)')
})

test('a drag-pan image cannot be zoomed out past filling the window', () => {
  const views: Array<CropView> = []
  const {container} = render(<ZoomableImage src="/tmp/a.png" dragPan={true} onChanged={v => views.push(v)} />)
  const {el, root} = sized(container, {height: 480, width: 640})
  fireEvent.load(el)
  for (let i = 0; i < 20; i++) fireEvent.wheel(root, {clientX: 150, clientY: 150, deltaY: -100})
  const view = views.at(-1)
  if (!view) throw new Error('no view')
  expect(view.scale).toBe(300 / 480)
  expect(cropViewToRect(view, 300)).toEqual({x0: 80, x1: 560, y0: 0, y1: 480})
})

test('a drag-pan image that loads before its container is laid out opens untransformed', () => {
  const views: Array<CropView> = []
  const {container} = render(<ZoomableImage src="/tmp/a.png" dragPan={true} onChanged={v => views.push(v)} />)
  const {el, root} = sized(container, {height: 480, width: 640})
  Object.defineProperty(root, 'clientWidth', {configurable: true, value: 0})
  fireEvent.load(el)
  expect(views.at(-1)).toMatchObject({height: 480, scale: 1, width: 640, x: -0, y: -0})
  expect(el.style.transform).toBe('')
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
