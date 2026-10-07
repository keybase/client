import * as React from 'react'
import type {ModalSize} from '@/constants/types/router'

export type ModalBox = {size: ModalSize}

// Provided by the modal route layout around a modal screen; undefined outside a modal.
export const ModalBoxContext = React.createContext<ModalBox | undefined>(undefined)

export const useModalBox = () => React.useContext(ModalBoxContext)
