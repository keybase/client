import * as React from 'react'
import * as PropProviders from './prop-providers'
import {TypedState} from '../reducers'
export type SelectorMap = {[K in string]: (arg0: any) => any | Object}

export class Story {
  addDecorator: (d: (s: () => React.ReactNode) => React.ReactNode) => Story
  add: (name: string, f: () => React.ReactNode) => Story
}

export declare function storiesOf(name: string, module: any): Story
export declare function action(name: string): any
export declare function perfDecorator(copiesToRender?: number): Function
export declare function scrollViewDecorator(): Function
export declare function createNavigator(props: Object): any
export declare function createStoreWithCommon(): TypedState
export declare function createPropProvider(
  ...maps: SelectorMap[]
): (arg0: () => React.ReactNode) => React.ReactNode
export declare function createPropProviderWithCommon(
  ...maps: SelectorMap[]
): (arg0: () => React.ReactNode) => React.ReactNode
export declare function unexpected(name: string): () => void
export declare class Rnd {
  constructor(seed: number | string)
  next(): number
  randInt(low: number, high: number): number
  generateString(regex: RegExp): string
}

export declare function propOverridesForStory(p: any): {}
export declare class MockStore extends React.Component<{store: any; children: React.ReactNode}> {}
export {PropProviders}
