import * as React from 'react'

// Split Picker so we can use ReactDOM on the desktop side to manually
// give it focus.

export type Props = {
  backgroundImageFn: (set: string, sheetSize: number) => string
  onClick: (
    arg0: {
      colons: string
    },
    evt: Event
  ) => void
}

export declare class Picker extends React.Component<Props> {}
