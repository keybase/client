import * as React from 'react'
import {Props, LeftActionProps} from './types'

export declare class HeaderHocHeader extends React.Component<Props> {}
export declare class LeftAction extends React.Component<LeftActionProps> {}
declare function HeaderHoc<P>(WrappedComponent: P): P
export default HeaderHoc
