import {isEntryRegistered, onRestack} from '../../overlay/controller.desktop'

// The open popups, each anchored to an element outside the overlay stack. They check their anchors
// again after any change to the stack (one popup may have mounted before what it anchors to) and
// while anything scrolls.

type AnchoredPopup = {
  // checks its anchor again
  syncAnchor: () => void
  // whether it is anchored in this element, or was, when its anchor was last there
  anchoredWithin: (element: Element) => boolean
  close: () => void
}

// by entry id, in the order they were added to the stack
const popups = new Map<string, AnchoredPopup>()

// a popup of an entry that just left the stack (opened from one that closed) stays out of it
const syncAll = () => {
  for (const [id, popup] of popups) {
    if (isEntryRegistered(id)) {
      popup.syncAnchor()
    }
  }
}

// While something scrolls, each open popup checks its anchor once a frame: where it is drawn is
// where it stays if its anchor hides.
let scrollFrame = 0
const onScroll = () => {
  if (scrollFrame) {
    return
  }
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0
    syncAll()
  })
}

let listening = false
const listen = () => {
  if (listening) {
    return
  }
  listening = true
  onRestack(syncAll)
  window.addEventListener('scroll', onScroll, {capture: true, passive: true})
}

// Add a popup before its entry joins the stack, so it checks its anchor as it does.
export const addAnchoredPopup = (id: string, popup: AnchoredPopup) => {
  listen()
  popups.set(id, popup)
  return () => {
    popups.delete(id)
  }
}

// A list recycled this row for another item: popups opened on what it showed before must not stay on
// what it shows now.
export const closePopupsAnchoredWithin = (row: Element) => {
  const open = [...popups].filter(([id]) => isEntryRegistered(id))
  for (const [, popup] of open) {
    if (popup.anchoredWithin(row)) {
      popup.close()
    }
  }
}
