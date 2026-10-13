import * as React from 'react'

// Modal dialogs are a desktop presentation.
export const PopupHostContext = React.createContext<unknown>(null)
export const getTopModalDialog = (): unknown => null
