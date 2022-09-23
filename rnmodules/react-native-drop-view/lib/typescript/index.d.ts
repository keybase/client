import * as React from 'react';
import { ViewStyle } from 'react-native';
export declare type DropItems = Array<{
    originalPath?: string;
    content?: string;
}>;
export declare type Props = {
    children?: React.ReactNode;
    onDropped: (items: DropItems) => void;
    style?: ViewStyle;
};
declare const DropViewWrapper: (p: Props) => JSX.Element;
export default DropViewWrapper;
