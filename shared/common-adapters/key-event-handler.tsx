import type * as React from 'react'

type EscapeHandlerProps = {
  onESC?: () => void
  children: React.ReactNode
}

export const EscapeHandler = (props: EscapeHandlerProps) => props.children as React.ReactElement
export const KeyEventHandler = (props: {children: React.ReactNode}) => props.children as React.ReactElement
export const GlobalKeyEventHandler = () => null
