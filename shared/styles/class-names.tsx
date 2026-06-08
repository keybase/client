/*
 * Adapted from classnames 2.5.1, limited to the argument shapes used in this repo:
 * strings, falsey values, object maps, and arrays of those values.
 *
 * Upstream license and attribution for the adapted code:
 *
 * Copyright (c) 2018 Jed Watson
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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
