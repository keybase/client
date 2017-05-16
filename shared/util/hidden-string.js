// @flow

// HiddenString tries to wrap a string value to prevent it from being easily
// output as a string to log, file or console
class HiddenString {
  _value: () => string

  constructor(stringValue: string) {
    this._value = () => stringValue
  }

  toString(): string {
    return '[HiddenString]'
  }

  stringValue(): string {
    return this._value()
  }
}

export default HiddenString
