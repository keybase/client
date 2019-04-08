import * as React from 'react'
import { StylesCrossPlatform } from '../styles';
import { TextType } from './text';

export type KeyboardType = "default" | "email-address" | "numeric" | "phone-pad" | "ascii-capable" | "numbers-and-punctuation" | "url" | "number-pad" | "name-phone-pad" | "decimal-pad" | "twitter" | "web-search" | "visible-password";

export type Selection = {
  start: number,
  end: number
};

export type Props = {
  autoFocus?: boolean,
  globalCaptureKeypress?: boolean,
  className?: string,
  disabled?: boolean,
  flexable?: boolean,
  maxLength?: number,
  maxBytes?: number,
  multiline?: boolean,
  onBlur?: () => void,
  onChangeText?: (text: string) => void,
  onFocus?: () => void,
  placeholder?: string,
  placeholderColor?: string,
  rowsMin?: number,
  rowsMax?: number,
  style?: StylesCrossPlatform,
  textType?: TextType,
  type?: "password" | "text",
  value?: string,
  onEnterKeyDown?: () => void,
  onClick?: (event: Event) => void,
  onKeyDown?: (event: React.KeyboardEvent, isComposingIME: boolean) => void,
  onKeyUp?: (event: React.KeyboardEvent, isComposingIME: boolean) => void,
  onKeyPress?: (
    event: {
      nativeEvent: {
        key: "Enter" | "Backspace" | string
      }
    }
  ) => void,
  autoCapitalize?: "none" | "sentences" | "words" | "characters",
  autoCorrect?: boolean,
  keyboardType?: KeyboardType,
  returnKeyType?: "done" | "go" | "next" | "search" | "send",
  selectTextOnFocus?: boolean,
  onEndEditing?: () => void,
  onSelectionChange?: (selection: Selection) => void
};

// Use this to mix your props with input props like type Props = PropsWithInput<{foo: number}>
export type PropsWithInput<P> = {} & Props & P;

/**
 * Flow does the work of making the default props nullable when instantiating
 * this component, but doesn't go as far as letting the props be
 * actually nullable in the type def. This complicates things when trying
 * to make this compatible with PropsWithInput. So here we split up the
 * internal type of Props from the public API, and 'lie' in this file
 * by claiming that this component takes `Props` when the implementations
 * use `InternalProps`.
 * See more discussion here: https://github.com/facebook/flow/issues/1660
 */
export type DefaultProps = {
  keyboardType: KeyboardType,
  textType: TextType
};

export type TextInfo = {
  text: string,
  selection: Selection
};

export type InternalProps = {} & DefaultProps & Props;
export declare class PlainInput extends React.Component<Props> {}
