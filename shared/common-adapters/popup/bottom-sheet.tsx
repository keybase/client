import * as React from 'react'
import type {BottomSheetModalProps, BottomSheetBackdropProps, BottomSheetHandleProps} from '@gorhom/bottom-sheet'
import * as _gorhomRaw from '@gorhom/bottom-sheet'

type NativeMethods = {present: () => void; forceClose: () => void}
type BackdropProps = BottomSheetBackdropProps & {disappearsOnIndex?: number; appearsOnIndex?: number; opacity?: number}
type HandleProps = BottomSheetHandleProps & {style?: object; indicatorStyle?: object; children?: React.ReactNode}
type ScrollViewProps = {style?: object; children?: React.ReactNode}
type GorhomModule = {
  BottomSheetModal: React.ForwardRefExoticComponent<BottomSheetModalProps & React.RefAttributes<NativeMethods>>
  BottomSheetView: React.ComponentType<{children?: React.ReactNode}>
  BottomSheetBackdrop: React.ComponentType<BackdropProps>
  BottomSheetScrollView: React.ComponentType<ScrollViewProps>
  BottomSheetHandle: React.ComponentType<HandleProps>
}

const _gorhom: GorhomModule | null = isMobile ? (_gorhomRaw as unknown as GorhomModule) : null

export const BottomSheetView = (_p: {children?: React.ReactNode}) => {
  if (!isMobile) return null
  const {BottomSheetView: NativeView} = _gorhom!
  return <NativeView>{_p.children}</NativeView>
}

export class BottomSheetModal extends React.Component<BottomSheetModalProps> {
  private _native: NativeMethods | null = null

  present() {
    this._native?.present()
  }

  forceClose() {
    this._native?.forceClose()
  }

  override render() {
    if (!isMobile) return null
    const {BottomSheetModal: NativeModal} = _gorhom!
    return (
      <NativeModal
        {...this.props}
        ref={(r: NativeMethods | null) => {
          this._native = r
        }}
      />
    )
  }
}

export const BottomSheetBackdrop = (_p: BackdropProps) => {
  if (!isMobile) return null
  const {BottomSheetBackdrop: NativeBackdrop} = _gorhom!
  return <NativeBackdrop {..._p} />
}

export const BottomSheetScrollView = (_p: ScrollViewProps) => {
  if (!isMobile) return null
  const {BottomSheetScrollView: NativeScrollView} = _gorhom!
  return <NativeScrollView {..._p} />
}

export const BottomSheetHandle = (_p: HandleProps) => {
  if (!isMobile) return null
  const {BottomSheetHandle: NativeHandle} = _gorhom!
  return <NativeHandle {..._p} />
}

export type {BottomSheetBackdropProps} from '@gorhom/bottom-sheet'
