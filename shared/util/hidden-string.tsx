// HiddenString tries to wrap a string value to prevent it from being easily
// output as a string to log, file or console.
const valueKey = Symbol('valueKey')
type WithValue = {[valueKey]: string}

export class HiddenString {
  constructor(stringValue: string) {
    Object.defineProperty(this, valueKey, {
      configurable: false,
      enumerable: false,
      value: stringValue,
      writable: false,
    })
  }

  stringValue() {
    return (this as unknown as WithValue)[valueKey]
  }

  equals(other: HiddenString) {
    return (this as unknown as WithValue)[valueKey] === (other as unknown as WithValue)[valueKey]
  }

  toString() {
    return '[HiddenString]'
  }

  toJSON() {
    return '[HiddenString]'
  }
}

export default HiddenString
