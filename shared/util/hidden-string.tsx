// HiddenString tries to wrap a string value to prevent it from being easily
// output as a string to log, file or console
class HiddenString {
  _value: () => string;

  constructor(stringValue: string) {
    this._value = () => stringValue
  }

  toString function(): string {
    return '[HiddenString]'
  }

  stringValue function(): string {
    return this._value()
  }
}

export default HiddenString
