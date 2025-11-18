import * as React from 'react'
import * as C from '@/constants'
import {HeaderLeftCancel2, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'
import cryptoTeamBuilder from '../team-building/page'

export const newRoutes = {
  [C.Crypto.decryptTab]: {
    getOptions: {headerShown: true, title: 'Decrypt'},
    screen: React.lazy(async () => {
      const {DecryptInput} = await import('./operations/decrypt')
      return {default: DecryptInput}
    }),
  },
  [C.Crypto.encryptTab]: {
    getOptions: {headerShown: true, title: 'Encrypt'},
    screen: React.lazy(async () => {
      const {EncryptInput} = await import('./operations/encrypt')
      return {default: EncryptInput}
    }),
  },
  [C.Crypto.signTab]: {
    getOptions: {headerShown: true, title: 'Sign'},
    screen: React.lazy(async () => {
      const {SignInput} = await import('./operations/sign')
      return {default: SignInput}
    }),
  },
  [C.Crypto.verifyTab]: {
    getOptions: {headerShown: true, title: 'Verify'},
    screen: React.lazy(async () => {
      const {VerifyInput} = await import('./operations/verify')
      return {default: VerifyInput}
    }),
  },
  cryptoRoot: {
    getOptions: C.isMobile ? {title: 'Crypto'} : {title: 'Crypto tools'},
    screen: React.lazy(async () => import('./sub-nav')),
  },
}

export const newModalRoutes = {
  [C.Crypto.decryptOutput]: {
    getOptions: {
      headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
      headerShown: true,
      title: 'Decrypted',
    },
    screen: React.lazy(async () => {
      const {DecryptOutput} = await import('./operations/decrypt')
      return {default: DecryptOutput}
    }),
  },
  [C.Crypto.encryptOutput]: {
    getOptions: {headerShown: true, title: 'Encrypted'},
    screen: React.lazy(async () => {
      const {EncryptOutput} = await import('./operations/encrypt')
      return {default: EncryptOutput}
    }),
  },
  [C.Crypto.signOutput]: {
    getOptions: {
      headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
      headerShown: true,
      title: 'Signed',
    },
    screen: React.lazy(async () => {
      const {SignOutput} = await import('./operations/sign')
      return {default: SignOutput}
    }),
  },
  [C.Crypto.verifyOutput]: {
    getOptions: {
      headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
      headerShown: true,
      title: 'Verified',
    },
    screen: React.lazy(async () => {
      const {VerifyOutput} = await import('./operations/verify')
      return {default: VerifyOutput}
    }),
  },
  cryptoTeamBuilder,
}

export type RootParamListCrypto = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
