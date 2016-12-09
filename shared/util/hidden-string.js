// @flow
import HiddenThing from './hidden-thing'

// HiddenString tries to wrap a string value to prevent it from being easily
// output as a string to log, file or console
class HiddenString extends HiddenThing<string> {
  toString (): string {
    return '[HiddenString]'
  }

  stringValue (): string {
    return this.thingValue()
  }
}

export default HiddenString
