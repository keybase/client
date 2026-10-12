import * as React from 'react'
import ReactDOM from 'react-dom'
import {useTopModalDialog} from './modal-dialog.desktop'

const contentsStyle = {display: 'contents'} as const

// For app-wide overlays that sit above everything, like the global error banner. While a modal dialog
// is open everything outside it is inert and under it, so they render inside the topmost one, which
// fills the window as the app root does. They always render into the same element, which is moved
// between dialogs, so they keep their state.
export const AboveModalDialogs = (p: {children: React.ReactNode}): React.ReactNode => {
  const top = useTopModalDialog()
  const [home, setHome] = React.useState<HTMLDivElement | null>(null)
  const [content] = React.useState(() => {
    const el = document.createElement('div')
    el.style.display = 'contents'
    return el
  })

  React.useLayoutEffect(() => {
    const parent = top ?? home
    if (!parent) {
      return undefined
    }
    parent.append(content)
    return () => {
      content.remove()
    }
  }, [content, home, top])

  return (
    <>
      <div ref={setHome} style={contentsStyle} />
      {ReactDOM.createPortal(p.children, content)}
    </>
  )
}
