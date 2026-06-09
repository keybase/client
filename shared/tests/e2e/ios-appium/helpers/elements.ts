import type {ChainablePromiseElement, ChainablePromiseArray} from 'webdriverio'

export const el = (id: string): ChainablePromiseElement => browser.$(`~${id}`)
export const els = (id: string): ChainablePromiseArray => browser.$$(`~${id}`)

export const waitForTestID = async (id: string, timeout = 5000) =>
  el(id).waitForDisplayed({timeout, timeoutMsg: `testID "${id}" never became visible`})

export const countTestID = async (id: string): Promise<number> => els(id).length

export const byText = (text: string): ChainablePromiseElement =>
  browser.$(`-ios predicate string:label == "${text}" OR name == "${text}"`)

export const tab = (label: string): ChainablePromiseElement => browser.$(`~${label}`)
