// HiddenString tries to wrap a string value to prevent it from being easily
// output as a string to log, file or console
class HiddenString {
  stringValue: () => string
  constructor(stringValue: string) {
    this.stringValue = () => stringValue
  }

  toString(): string {
    return '[HiddenString]'
  }
}

export default HiddenString
