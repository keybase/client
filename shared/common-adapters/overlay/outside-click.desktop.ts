import {rootEntryId} from './context'
import {derive, entries, entryAt, isClosing} from './registry.desktop'
import {outsideClickEntry, pressOn} from './stack.desktop'

// One entry per click: the topmost dismissable one closes when a press both starts and ends outside
// it, without moving (a drag, like selecting text, is not a click). Inside means in its content or
// in any entry opened from it, wherever that is in the DOM. A press on something above it, like an
// app-wide banner, leaves it open.
type Press = {entry: string; outside: boolean; x: number; y: number}
let press: Press | undefined

const isOutside = (id: string, target: EventTarget | null) => {
  const element = target instanceof Element ? target : null
  const hit = entryAt(element)?.id ?? rootEntryId
  const content = entries.get(id)?.outside?.content()
  const inContent = !!element && !!content?.contains(element)
  return pressOn(entries, derive().order, id, {entry: hit, inContent}) === 'outside'
}

export const onMouseDown = (ev: MouseEvent) => {
  const {covered, order} = derive()
  const entry = outsideClickEntry(order, covered)
  press =
    entry === undefined ? undefined : {entry, outside: isOutside(entry, ev.target), x: ev.clientX, y: ev.clientY}
}

export const onMouseUp = (ev: MouseEvent) => {
  const p = press
  press = undefined
  if (!p?.outside || Math.abs(ev.clientX - p.x) >= 5 || Math.abs(ev.clientY - p.y) >= 5) {
    return
  }
  const {covered, order} = derive()
  const outside = entries.get(p.entry)?.outside
  if (
    !outside ||
    outsideClickEntry(order, covered) !== p.entry ||
    !isOutside(p.entry, ev.target) ||
    isClosing(p.entry)
  ) {
    return
  }
  if (!outside.propagate) {
    ev.stopPropagation()
  }
  outside.onOutside()
}
