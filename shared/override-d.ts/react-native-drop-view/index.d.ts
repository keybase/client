import * as React from 'react';
import { View, ViewStyle } from 'react-native';
export declare type DropItems = Array<{
    originalPath?: string;
    content?: string;
}>;
export declare type Props = {
    children?: React.ReactNode;
    onDropped: (items: DropItems) => void;
    style?: ViewStyle;
};
declare const _default: ((p: Props) => JSX.Element) | typeof View;
export default _default;
