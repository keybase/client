import * as React from 'react'

// Mobile only. Show native dropdown UI.

export type PickerItem<T> = {
  label: string,
  value: T
};

export type Props<T extends string | number> = {
  items: PickerItem<T>[],
  selectedValue: T | null,
  onSelect: (t: T) => void,
  header?: React.ElementType,
  prompt?: React.ElementType,
  promptString?: string,
  onHidden: () => void,
  onCancel: () => void,
  onDone: () => void,
  visible: boolean
};

export declare class FloatingPicker<T extends string | number> extends React.Component<Props<T>> {}
