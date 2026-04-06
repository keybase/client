/*
 * Adapted from classnames 2.5.1 (MIT), limited to the argument shapes used in this repo:
 * strings, falsey values, object maps, and arrays of those values.
 */

type ClassNameMap = Record<string, unknown>
type ClassNameArg = ClassNameMap | ReadonlyArray<ClassNameArg> | string | false | null | undefined

const hasOwnProperty = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key)

const appendClass = (value: string, newClass: string): string => {
  if (!newClass) {
    return value
  }

  if (value) {
    return `${value} ${newClass}`
  }

  return newClass
}

const parseValue = (arg: Exclude<ClassNameArg, false | null | undefined>): string => {
  if (typeof arg === 'string') {
    return arg
  }

  if (Array.isArray(arg)) {
    let classes = ''
    for (const value of arg) {
      if (!value) {
        continue
      }
      classes = appendClass(classes, parseValue(value))
    }
    return classes
  }

  let classes = ''
  const map = arg as ClassNameMap
  for (const key in map) {
    if (hasOwnProperty(map, key) && map[key]) {
      classes = appendClass(classes, key)
    }
  }
  return classes
}

const classNames = (...args: Array<ClassNameArg>): string => {
  let classes = ''
  for (const arg of args) {
    if (!arg) {
      continue
    }
    classes = appendClass(classes, parseValue(arg))
  }
  return classes
}

export default classNames
