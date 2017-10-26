// @flow
import {maskStrings} from '../local-debug'
import repeat from 'lodash/repeat'

// HiddenString tries to wrap a string value to prevent it from being easily
// output as a string to log, file or console
class HiddenString {
  _value: () => string

  constructor(stringValue: string) {
    if (maskStrings && stringValue) {
      this._value = () =>
        repeat('MaSkEd', Math.ceil(stringValue.length / 'MaSkEd'.length)).substr(0, stringValue.length)
    } else {
      this._value = () => stringValue
    }
  }

  toString(): string {
    return '[HiddenString]'
  }

  stringValue(): string {
    return this._value()
  }
}

export default HiddenString
