import * as React from 'react'
import { StylesCrossPlatform } from '../styles';
import { TextType } from './text';

export type KeyboardType = "default" | "email-address" | "numeric" | "phone-pad" | "ascii-capable" | "numbers-and-punctuation" | "url" | "number-pad" | "name-phone-pad" | "decimal-pad" | "twitter" | "web-search" | "visible-password";

export type Props = {
  smartAutoresize?: boolean,
  autoFocus?: boolean,
  className?: string,
  editable?: boolean,
  errorStyle?: StylesCrossPlatform,
  errorText?: string | null,
  errorTextComponent?: React.Element<any>,
  floatingHintTextOverride?: string | null,
  hideUnderline?: boolean,
  hintText?: string | null,
  key?: string,
  inputStyle?: StylesCrossPlatform,
  multiline?: boolean,
  onBlur?: () => void,
  onClick?: (event: Event) => void,
  onChangeText?: (text: string) => void,
  onFocus?: () => void,
  rowsMax?: number,
  maxLength?: number,
  rowsMin?: number,
  hideLabel?: boolean,
  small?: boolean,
  smallLabel?: string,
  smallLabelStyle?: StylesCrossPlatform,
  style?: StylesCrossPlatform,
  type?: "password" | "text" | "passwordVisible",
  value?: string | null,
  selectTextOnFocus?: boolean,
  clearTextCounter?: number,
  onEnterKeyDown?: (event: React.KeyboardEvent) => void | null,
  uncontrolled?: boolean,
  onKeyDown?: (event: React.KeyboardEvent, isComposingIME: boolean) => void,
  onKeyUp?: (event: React.KeyboardEvent, isComposingIME: boolean) => void,
  onEndEditing?: () => void | null,
  autoCapitalize?: "none" | "sentences" | "words" | "characters",
  autoCorrect?: boolean,
  keyboardType?: KeyboardType,
  returnKeyType?: "done" | "go" | "next" | "search" | "send"
};

export type Selection = {
  start: number,
  end: number
};

export type TextInfo = {
  text: string,
  selection: Selection
};

export declare class Input extends React.Component<Props> {}
