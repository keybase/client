import * as React from 'react'
import {OverlayEntryContext} from '../overlay/context'
import {useOverlayEntry} from '../overlay/entry.desktop'

type Props = {
  children: React.ReactNode
  // false closes the dialog and hides its content, which stays mounted
  open?: boolean
  // Escape when nothing inside the dialog handles it
  onEscape?: () => void
  // false: an Escape an input already handled and stopped does nothing more. By default it still
  // reaches the dialog
  stoppedEscapeReachesDialog?: boolean
}

// A modal dialog makes everything outside it inert, so popups opened inside one portal into it.
export const PopupHostContext = React.createContext<HTMLElement | null>(null)

// A dialog inside another is shown only while its parent is, and after it, so it stacks above it.
const ParentOpenContext = React.createContext(true)

// Open dialogs in the order they were shown, the last one on top.
let openDialogs: ReadonlyArray<HTMLDialogElement> = []
const openDialogsListeners = new Set<() => void>()
const setOpenDialogs = (next: ReadonlyArray<HTMLDialogElement>) => {
  openDialogs = next
  openDialogsListeners.forEach(l => l())
}
const subscribeOpenDialogs = (listener: () => void) => {
  openDialogsListeners.add(listener)
  return () => {
    openDialogsListeners.delete(listener)
  }
}

// What had focus in a dialog when another opened above it. Closing that one restores focus there
// natively, unless this dialog was closed meanwhile (a router modal under the topmost one is).
const focusBeforeCovered = new WeakMap<HTMLDialogElement, HTMLElement>()

// The topmost open modal dialog: content outside every dialog that has to stay above them and
// interactive renders into it.
const getTopModalDialog = () => openDialogs.at(-1) ?? null
export const useTopModalDialog = () => React.useSyncExternalStore(subscribeOpenDialogs, getTopModalDialog)

// A full-window <dialog> shown with showModal(). It and its ::backdrop draw nothing; the content
// draws its own cover. It is a modal entry in the overlay stack, which routes keys to it, so a popup
// open inside the dialog takes Escape before the dialog does.
export function ModalDialog(props: Props) {
  const {children, onEscape, open = true, stoppedEscapeReachesDialog = true} = props
  const parentOpen = React.use(ParentOpenContext)
  const [dialog, setDialog] = React.useState<HTMLDialogElement | null>(null)
  const [isOpen, setIsOpen] = React.useState(false)
  // the content first mounts in an open dialog, so focusing on mount works
  const [hasOpened, setHasOpened] = React.useState(false)
  const openedBeforeRef = React.useRef(false)
  const shouldOpen = parentOpen && open
  const entry = useOverlayEntry({
    acceptsKeys: true,
    active: isOpen,
    blocking: true,
    kind: 'modal',
    onEscape,
    stoppedEscapeCloses: stoppedEscapeReachesDialog,
  })

  // A ref callback rather than an effect, so it runs again whenever shouldOpen changes. It runs after
  // the effects of what is inside, which is why the content waits for the first showModal.
  const dialogRef = React.useCallback(
    (el: HTMLDialogElement) => {
      setDialog(el)
      if (!shouldOpen) {
        return () => {
          setDialog(null)
        }
      }
      // the overlay stack handles Escape, including one an input stopped, so the browser must not
      // close the dialog for it
      const onCancel = (e: Event) => {
        e.preventDefault()
      }
      // Chromium lets a page cancel only so many close requests without user activation in between,
      // after which the dialog closes anyway
      const onClose = () => {
        if (!el.open) {
          el.showModal()
        }
      }
      el.addEventListener('cancel', onCancel)
      el.addEventListener('close', onClose)
      const covered = openDialogs.at(-1)
      const active = document.activeElement
      if (covered && active instanceof HTMLElement && covered.contains(active)) {
        focusBeforeCovered.set(covered, active)
      }
      el.showModal()
      // Opening, showModal focuses the dialog itself, as the content is not mounted yet. Reopening,
      // it would focus the first focusable thing in it, so put focus back where it was instead.
      if (openedBeforeRef.current) {
        const saved = focusBeforeCovered.get(el)
        const target = saved && el.contains(saved) ? saved : el
        target.focus()
      }
      focusBeforeCovered.delete(el)
      openedBeforeRef.current = true
      setOpenDialogs([...openDialogs, el])
      setIsOpen(true)
      setHasOpened(true)
      return () => {
        el.removeEventListener('cancel', onCancel)
        el.removeEventListener('close', onClose)
        el.close()
        setOpenDialogs(openDialogs.filter(d => d !== el))
        setIsOpen(false)
        setDialog(null)
      }
    },
    [shouldOpen]
  )

  return (
    <dialog className="modal-dialog" ref={dialogRef} tabIndex={-1}>
      {hasOpened ? (
        <ParentOpenContext value={isOpen}>
          <PopupHostContext value={dialog}>
            <OverlayEntryContext value={entry}>{children}</OverlayEntryContext>
          </PopupHostContext>
        </ParentOpenContext>
      ) : null}
    </dialog>
  )
}
