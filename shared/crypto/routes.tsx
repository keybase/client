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
const DecryptOutput = React.lazy(async () => {
  const {DecryptOutput} = await import('./operations/decrypt')
  return {default: DecryptOutput}
})
const EncryptInput = React.lazy(async () => {
  const {EncryptInput} = await import('./operations/encrypt')
  return {default: EncryptInput}
})
const EncryptOutput = React.lazy(async () => {
  const {EncryptOutput} = await import('./operations/encrypt')
  return {default: EncryptOutput}
})
const SignInput = React.lazy(async () => {
  const {SignInput} = await import('./operations/sign')
  return {default: SignInput}
})
const SignOutput = React.lazy(async () => {
  const {SignOutput} = await import('./operations/sign')
  return {default: SignOutput}
})
const VerifyInput = React.lazy(async () => {
  const {VerifyInput} = await import('./operations/verify')
  return {default: VerifyInput}
})
const VerifyOutput = React.lazy(async () => {
  const {VerifyOutput} = await import('./operations/verify')
  return {default: VerifyOutput}
})

export const newRoutes = {
  [Constants.encryptTab]: {
    getOptions: {headerShown: true, needsKeyboard: true, title: 'Encrypt'},
    screen: EncryptInput,
  },
  [Constants.decryptTab]: {
    getOptions: {headerShown: true, needsKeyboard: true, title: 'Decrypt'},
    screen: DecryptInput,
  },
  [Constants.signTab]: {
    getOptions: {headerShown: true, needsKeyboard: true, title: 'Sign'},
    screen: SignInput,
  },
  [Constants.verifyTab]: {
    getOptions: {headerShown: true, needsKeyboard: true, title: 'Verify'},
    screen: VerifyInput,
  },
  cryptoRoot,
}
export const newModalRoutes = {
  cryptoTeamBuilder,
  [Constants.encryptOutput]: {
    getOptions: {headerShown: true, needsKeyboard: false, title: 'Encrypted'},
    screen: EncryptOutput,
  },
  [Constants.decryptOutput]: {
    getOptions: {
      headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
      headerShown: true,
      needsKeyboard: false,
      title: 'Decrypted',
    },
    screen: DecryptOutput,
  },
  [Constants.signOutput]: {
    getOptions: {
      headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
      headerShown: true,
      needsKeyboard: false,
      title: 'Signed',
    },
    screen: SignOutput,
  },
  [Constants.verifyOutput]: {
    getOptions: {
      headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
      headerShown: true,
      needsKeyboard: false,
      title: 'Verified',
    },
    screen: VerifyOutput,
  },
}

export type RootParamListCrypto = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
