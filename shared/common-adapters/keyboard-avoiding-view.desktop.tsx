import * as React from 'react'
import type {AnimatedProps} from './keyboard-avoiding-view'

const RenderChildren = ({children}: {children?: React.ReactNode}) => children || null

export const AnimatedKeyboardAvoidingView = (p: AnimatedProps) => p.children || null

export default RenderChildren
