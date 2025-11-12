import * as React from 'react'
import type * as C from '@/constants'
import * as Constants from '@/constants/crypto'
import {HeaderLeftCancel2, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'
import cryptoRoot from './sub-nav/page'
import cryptoTeamBuilder from '../team-building/page'

export const newRoutes = {
  [Constants.decryptTab]: C.makeScreen(
    React.lazy(async () => {
      const {DecryptInput} = await import('./operations/decrypt')
      return {default: DecryptInput}
    }),
    {getOptions: {headerShown: true, needsKeyboard: true, title: 'Decrypt'}}
  ),
  [Constants.encryptTab]: C.makeScreen(
    React.lazy(async () => {
      const {EncryptInput} = await import('./operations/encrypt')
      return {default: EncryptInput}
    }),
    {getOptions: {headerShown: true, needsKeyboard: true, title: 'Encrypt'}}
  ),
  [Constants.signTab]: C.makeScreen(
    React.lazy(async () => {
      const {SignInput} = await import('./operations/sign')
      return {default: SignInput}
    }),
    {getOptions: {headerShown: true, needsKeyboard: true, title: 'Sign'}}
  ),
  [Constants.verifyTab]: C.makeScreen(
    React.lazy(async () => {
      const {VerifyInput} = await import('./operations/verify')
      return {default: VerifyInput}
    }),
    {getOptions: {headerShown: true, needsKeyboard: true, title: 'Verify'}}
  ),
  cryptoRoot,
}

export const newModalRoutes = {
  [Constants.decryptOutput]: C.makeScreen(
    React.lazy(async () => {
      const {DecryptOutput} = await import('./operations/decrypt')
      return {default: DecryptOutput}
    }),
    {
      getOptions: {
        headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
        headerShown: true,
        needsKeyboard: false,
        title: 'Decrypted',
      },
    }
  ),
  [Constants.encryptOutput]: C.makeScreen(
    React.lazy(async () => {
      const {EncryptOutput} = await import('./operations/encrypt')
      return {default: EncryptOutput}
    }),
    {getOptions: {headerShown: true, needsKeyboard: false, title: 'Encrypted'}}
  ),
  [Constants.signOutput]: C.makeScreen(
    React.lazy(async () => {
      const {SignOutput} = await import('./operations/sign')
      return {default: SignOutput}
    }),
    {
      getOptions: {
        headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
        headerShown: true,
        needsKeyboard: false,
        title: 'Signed',
      },
    }
  ),
  [Constants.verifyOutput]: C.makeScreen(
    React.lazy(async () => {
      const {VerifyOutput} = await import('./operations/verify')
      return {default: VerifyOutput}
    }),
    {
      getOptions: {
        headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
        headerShown: true,
        needsKeyboard: false,
        title: 'Verified',
      },
    }
  ),
  cryptoTeamBuilder,
}

export type RootParamListCrypto = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
