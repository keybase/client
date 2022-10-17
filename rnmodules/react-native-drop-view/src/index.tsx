import * as React from 'react'
import {
    View,
    requireNativeComponent,
    UIManager,
    Platform,
    ViewStyle,
} from 'react-native';

const LINKING_ERROR =
    `The package 'react-native-drop-view' doesn't seem to be linked. Make sure: \n\n` +
    Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
    '- You rebuilt the app after installing the package\n' +
    '- You are not using Expo managed workflow\n';

export type DropItems = Array<{ originalPath?: string; content?: string }>
export type Props = {
    children?: React.ReactNode
    onDropped: (items: DropItems) => void
    style?: ViewStyle;
}

const ComponentName = 'DropView';
const isSupported = Platform.OS === 'ios'
const IMPL =
    isSupported ?
        UIManager.getViewManagerConfig(ComponentName) != null
            ? requireNativeComponent<Props>(ComponentName)
            : () => {
                throw new Error(LINKING_ERROR);
            }
        : null

const DropViewWrapper = (p: Props) => {
    const { onDropped } = p
    const onDroppedCB = React.useCallback(
        (e: any) => {
            try {
                const manifest = e.nativeEvent.manifest as DropItems
                const cleanedUp = manifest.reduce((arr, item) => {
                    if (item.originalPath || item.content) {
                        arr.push(item)
                    }
                    return arr
                }, new Array<DropItems[0]>())
                onDropped(cleanedUp)
            } catch (e) {
                console.log('drop view error', e)
            }
        },
        [onDropped]
    )
    // @ts-ignore
    return <IMPL {...p} onDropped={onDroppedCB} />
}
export default isSupported ? DropViewWrapper : View
