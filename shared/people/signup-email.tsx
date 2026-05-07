import * as React from 'react'

let signupEmail = ''
const listeners = new Set<() => void>()

const notify = () => {
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useSignupEmail = () => React.useSyncExternalStore(subscribe, () => signupEmail)

export const getSignupEmail = () => signupEmail

export const setSignupEmail = (email: string) => {
  if (signupEmail === email) {
    return
  }
  signupEmail = email
  notify()
}

export const clearSignupEmail = () => {
  if (!signupEmail) {
    return
  }
  signupEmail = ''
  notify()
}
