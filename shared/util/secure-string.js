/* @flow */

class SecureString {
  _value: () => string;

  constructor (stringValue: string) {
    this._value = () => stringValue
  }

  toString (): string {
    return '[protected SecureString]'
  }

  stringValue (): string {
    return this._value()
  }
}

export default SecureString
