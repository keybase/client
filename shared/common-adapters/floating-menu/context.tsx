import * as React from 'react'
// escape hatch to make a floating to a modal
export type FloatingModalType = boolean | 'bottomsheet'
export const FloatingModalContext = React.createContext<FloatingModalType>(false)
