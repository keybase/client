import type * as React from 'react'
import ReactDOM from 'react-dom'
import {useTopModalDialog} from './modal-dialog.desktop'

// For app-wide overlays that sit above everything, like the global error banner. While a modal dialog
// is open everything outside it is inert and under it, so they render inside the topmost one, which
// fills the window as the app root does. Moving in or out of a dialog remounts them.
export const AboveModalDialogs = (p: {children: React.ReactNode}): React.ReactNode => {
  const top = useTopModalDialog()
  return top ? ReactDOM.createPortal(p.children, top) : p.children
}
