// HiddenString tries to wrap a string value to prevent it from being easily
// output as a string to log, file or console
const valueKey = Symbol('valueKey')

class HiddenString {
  private [valueKey]: string = ''

  constructor(stringValue: string) {
    Object.defineProperty(this, valueKey, {
      configurable: false,
      enumerable: false,
      value: stringValue,
      writable: false,
    })
  }

  stringValue() {
    return this[valueKey]
  }

  toString() {
    return '[HiddenString]'
  }

  toJSON() {
    return '[HiddenString]'
  }
}

export default HiddenString

