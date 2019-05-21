import * as React from 'react'
import * as PropProviders from './prop-providers'
export type SelectorMap = {
  [K in string]: (arg0: any) => any | Object;
};

export declare function storiesOf(name: string, module: any): any;
export declare function action(name: string): any;
export declare function perfDecorator(copiesToRender?: number): Function;
export declare function scrollViewDecorator(): Function;
export declare function createPropProvider(...maps: SelectorMap[]): (arg0: () => React.ElementType) => React.ElementType;
export declare function createPropProviderWithCommon(...maps: SelectorMap[]): (arg0: () => React.ElementType) => React.ElementType;
export declare function unexpected(name: string): () => void;
export declare class Rnd {}
export declare function propOverridesForStory(p: any): {};

export {PropProviders}
