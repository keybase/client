if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

class HiddenString {
  _value = ''
  constructor(stringValue: string) {
    this._value = stringValue
  }

  toString(): string {
    return this._value
  }

  stringValue(): string {
    return this._value
  }
}

export default HiddenString
