import * as React from 'react'
import type * as C from '@/constants'
import * as Constants from '@/constants/crypto'
import {HeaderLeftCancel2, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'
import cryptoRoot from './sub-nav/page'
import cryptoTeamBuilder from '../team-building/page'

const DecryptInput = React.lazy(async () => {
  const {DecryptInput} = await import('./operations/decrypt')
  return {default: DecryptInput}
})
const decryptIn = {
  getOptions: {headerShown: true, needsKeyboard: true, title: 'Decrypt'},
  screen: DecryptInput,
}

const DecryptOutput = React.lazy(async () => {
  const {DecryptOutput} = await import('./operations/decrypt')
  return {default: DecryptOutput}
})
const decryptOut = {
  getOptions: {
    headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
    headerShown: true,
    needsKeyboard: false,
    title: 'Decrypted',
  },
  screen: DecryptOutput,
}

const EncryptInput = React.lazy(async () => {
  const {EncryptInput} = await import('./operations/encrypt')
  return {default: EncryptInput}
})
const encryptIn = {
  getOptions: {headerShown: true, needsKeyboard: true, title: 'Encrypt'},
  screen: EncryptInput,
}

const EncryptOutput = React.lazy(async () => {
  const {EncryptOutput} = await import('./operations/encrypt')
  return {default: EncryptOutput}
})
const encryptOut = {
  getOptions: {headerShown: true, needsKeyboard: false, title: 'Encrypted'},
  screen: EncryptOutput,
}

const SignInput = React.lazy(async () => {
  const {SignInput} = await import('./operations/sign')
  return {default: SignInput}
})
const signIn = {
  getOptions: {headerShown: true, needsKeyboard: true, title: 'Sign'},
  screen: SignInput,
}

const SignOutput = React.lazy(async () => {
  const {SignOutput} = await import('./operations/sign')
  return {default: SignOutput}
})
const signOut = {
  getOptions: {
    headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
    headerShown: true,
    needsKeyboard: false,
    title: 'Signed',
  },
  screen: SignOutput,
}

const VerifyInput = React.lazy(async () => {
  const {VerifyInput} = await import('./operations/verify')
  return {default: VerifyInput}
})
const verifyIn = {
  getOptions: {headerShown: true, needsKeyboard: true, title: 'Verify'},
  screen: VerifyInput,
}

const VerifyOutput = React.lazy(async () => {
  const {VerifyOutput} = await import('./operations/verify')
  return {default: VerifyOutput}
})
const verifyOut = {
  getOptions: {
    headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
    headerShown: true,
    needsKeyboard: false,
    title: 'Verified',
  },
  screen: VerifyOutput,
}

export const newRoutes = {
  [Constants.encryptTab]: encryptIn,
  [Constants.decryptTab]: decryptIn,
  [Constants.signTab]: signIn,
  [Constants.verifyTab]: verifyIn,
  cryptoRoot,
}
export const newModalRoutes = {
  cryptoTeamBuilder,
  [Constants.encryptOutput]: encryptOut,
  [Constants.decryptOutput]: decryptOut,
  [Constants.signOutput]: signOut,
  [Constants.verifyOutput]: verifyOut,
}

export type RootParamListCrypto = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
