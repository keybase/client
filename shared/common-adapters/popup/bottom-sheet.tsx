import * as React from 'react'
import type {StylesCrossPlatform} from '@/styles'
import type {BottomSheetModalProps, BottomSheetBackdropProps, BottomSheetFooterProps} from '@gorhom/bottom-sheet'
import * as _gorhomRaw from '@gorhom/bottom-sheet'

type NativeMethods = {present: () => void; forceClose: () => void}
type BackdropProps = BottomSheetBackdropProps & {disappearsOnIndex?: number; appearsOnIndex?: number; opacity?: number}
type ScrollViewProps = {
  style?: StylesCrossPlatform
  children?: React.ReactNode
  enableFooterMarginAdjustment?: boolean
  alwaysBounceVertical?: boolean
  overScrollMode?: 'auto' | 'always' | 'never'
}
type FooterProps = BottomSheetFooterProps & {bottomInset?: number; children?: React.ReactNode}
type GorhomModule = {
  BottomSheetModal: React.ForwardRefExoticComponent<BottomSheetModalProps & React.RefAttributes<NativeMethods>>
  BottomSheetBackdrop: React.ComponentType<BackdropProps>
  BottomSheetScrollView: React.ComponentType<ScrollViewProps>
  BottomSheetFooter: React.ComponentType<FooterProps>
}

const _gorhom: GorhomModule | null = isMobile ? (_gorhomRaw as unknown as GorhomModule) : null

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

export const BottomSheetFooter = (_p: FooterProps) => {
  if (!isMobile) return null
  const {BottomSheetFooter: NativeFooter} = _gorhom!
  return <NativeFooter {..._p} />
}

export type {BottomSheetBackdropProps, BottomSheetFooterProps} from '@gorhom/bottom-sheet'
