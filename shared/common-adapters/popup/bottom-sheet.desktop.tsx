import * as React from 'react'

// Desktop stubs for mobile-only bottom sheet components
export const BottomSheetView = (_p: {children?: React.ReactNode}) => null
export class BottomSheetModal extends React.Component<Record<string, unknown>> {
  present() {}
  forceClose() {}
  override render() {
    return null
  }
}
export const BottomSheetBackdrop = (_p: Record<string, unknown>) => null
export const BottomSheetScrollView = (_p: {style?: object; children?: React.ReactNode}) => null
export const BottomSheetHandle = () => null
export type BottomSheetBackdropProps = Record<string, never>
