import * as React from 'react'
import * as C from '@/constants'
import * as Crypto from '@/constants/crypto'
import {HeaderLeftButton, type HeaderBackButtonProps} from '@/common-adapters/header-buttons'
import cryptoTeamBuilder from '../team-building/page'
import type {StaticScreenProps} from '@react-navigation/core'
import type {
  CommonOutputRouteParams,
  CryptoInputRouteParams,
  CryptoTeamBuilderResult,
  EncryptOutputRouteParams,
  EncryptRouteParams,
} from './state'

type CryptoTeamBuilderRouteParams = Parameters<typeof cryptoTeamBuilder.screen>[0]['route']['params'] & {
  teamBuilderNonce?: string
  teamBuilderUsers?: CryptoTeamBuilderResult
}

const DecryptInputScreen = React.lazy(async () => {
  const {DecryptInput} = await import('./operations/decrypt')
  return {
    default: (p: StaticScreenProps<CryptoInputRouteParams>) => <DecryptInput {...p} />,
  }
})

const EncryptInputScreen = React.lazy(async () => {
  const {EncryptInput} = await import('./operations/encrypt')
  return {
    default: (p: StaticScreenProps<EncryptRouteParams>) => <EncryptInput {...p} />,
  }
})

const SignInputScreen = React.lazy(async () => {
  const {SignInput} = await import('./operations/sign')
  return {
    default: (p: StaticScreenProps<CryptoInputRouteParams>) => <SignInput {...p} />,
  }
})

const VerifyInputScreen = React.lazy(async () => {
  const {VerifyInput} = await import('./operations/verify')
  return {
    default: (p: StaticScreenProps<CryptoInputRouteParams>) => <VerifyInput {...p} />,
  }
})

const DecryptOutputScreen = React.lazy(async () => {
  const {DecryptOutput} = await import('./operations/decrypt')
  return {
    default: (p: StaticScreenProps<CommonOutputRouteParams>) => <DecryptOutput {...p} />,
  }
})

const EncryptOutputScreen = React.lazy(async () => {
  const {EncryptOutput} = await import('./operations/encrypt')
  return {
    default: (p: StaticScreenProps<EncryptOutputRouteParams>) => <EncryptOutput {...p} />,
  }
})

const SignOutputScreen = React.lazy(async () => {
  const {SignOutput} = await import('./operations/sign')
  return {
    default: (p: StaticScreenProps<CommonOutputRouteParams>) => <SignOutput {...p} />,
  }
})

const VerifyOutputScreen = React.lazy(async () => {
  const {VerifyOutput} = await import('./operations/verify')
  return {
    default: (p: StaticScreenProps<CommonOutputRouteParams>) => <VerifyOutput {...p} />,
  }
})

const CryptoTeamBuilderScreen = React.lazy(async () => {
  const {default: teamBuilder} = await import('../team-building/page')
  const TeamBuilderScreen = teamBuilder.screen
  return {
    default: (p: StaticScreenProps<CryptoTeamBuilderRouteParams>) => {
      const {teamBuilderNonce: _teamBuilderNonce, teamBuilderUsers: _teamBuilderUsers, ...params} = p.route.params
      return <TeamBuilderScreen {...p} route={{...p.route, params}} />
    },
  }
})

export const newRoutes = {
  [Crypto.decryptTab]: {
    getOptions: {headerShown: true, title: 'Decrypt'},
    screen: DecryptInputScreen,
  },
  [Crypto.encryptTab]: {
    getOptions: {headerShown: true, title: 'Encrypt'},
    screen: EncryptInputScreen,
  },
  [Crypto.signTab]: {
    getOptions: {headerShown: true, title: 'Sign'},
    screen: SignInputScreen,
  },
  [Crypto.verifyTab]: {
    getOptions: {headerShown: true, title: 'Verify'},
    screen: VerifyInputScreen,
  },
  cryptoRoot: {
    getOptions: C.isMobile ? {title: 'Crypto'} : {title: 'Crypto tools'},
    screen: React.lazy(async () => import('./sub-nav')),
  },
}

export const newModalRoutes = {
  [Crypto.decryptOutput]: {
    getOptions: {
      headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftButton mode="cancel" {...p} />,
      headerShown: true,
      title: 'Decrypted',
    },
    screen: DecryptOutputScreen,
  },
  [Crypto.encryptOutput]: {
    getOptions: {headerShown: true, title: 'Encrypted'},
    screen: EncryptOutputScreen,
  },
  [Crypto.signOutput]: {
    getOptions: {
      headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftButton mode="cancel" {...p} />,
      headerShown: true,
      title: 'Signed',
    },
    screen: SignOutputScreen,
  },
  [Crypto.verifyOutput]: {
    getOptions: {
      headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftButton mode="cancel" {...p} />,
      headerShown: true,
      title: 'Verified',
    },
    screen: VerifyOutputScreen,
  },
  cryptoTeamBuilder: {
    ...cryptoTeamBuilder,
    screen: CryptoTeamBuilderScreen,
  },
}
