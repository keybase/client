import * as Styles from '../styles'
export type Props = {
  onCancel?: (() => void) | null
  onBack?: (() => void) | null
  style?: Styles.StylesCrossPlatform | null
}

export declare function HeaderOrPopupWithHeader<P>(WrappedComponent: P): P
declare function HeaderOrPopup<P>(WrappedComponent: P): P
export default HeaderOrPopup
