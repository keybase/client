// @flow

// HiddenThing tries to wrap a string value to prevent it from being easily
// output as a string to log, file or console
class HiddenThing<T> {
  _value: () => T;

  constructor (thing: T) {
    this._value = () => thing
  }

  toString (): string {
    return '[HiddenThing]'
  }

  thingValue (): T {
    return this._value()
  }
}

export default HiddenThing
