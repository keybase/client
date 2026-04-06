/*
 * Adapted from classnames 2.5.1 (MIT), limited to the argument shapes used in this repo:
 * strings, falsey values, object maps, and arrays of those values.
 */

type ClassNameMap = Record<string, boolean | null | undefined>
type ClassNameArg = ClassNameMap | ReadonlyArray<ClassNameArg> | string | false | null | undefined

const hasOwnProperty = Object.prototype.hasOwnProperty

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
  for (const key in arg) {
    if (hasOwnProperty.call(arg, key) && arg[key]) {
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
