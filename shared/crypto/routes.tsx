import * as React from 'react'
import * as C from '@/constants'
import * as Crypto from '@/constants/crypto'
import {HeaderLeftButton, type HeaderBackButtonProps} from '@/common-adapters/header-buttons'
import cryptoTeamBuilder from '../team-building/page'
import {TeamBuilderScreen} from '../team-building/page'
import type {StaticScreenProps} from '@react-navigation/core'
import {defineRouteMap, type GetOptionsRet} from '@/constants/types/router'
import type {
  CommonOutputRouteParams,
  CryptoInputRouteParams,
} from './helpers'
import type {CryptoTeamBuilderResult, EncryptOutputRouteParams, EncryptRouteParams} from './encrypt'

type CryptoTeamBuilderRouteParams = Parameters<typeof cryptoTeamBuilder.screen>[0]['route']['params'] & {
  teamBuilderNonce?: string
  teamBuilderUsers?: CryptoTeamBuilderResult
}

const DecryptInputScreen = React.lazy(async () => {
  const {DecryptInput} = await import('./decrypt')
  return {
    default: (_p: StaticScreenProps<CryptoInputRouteParams>) => <DecryptInput />,
  }
})

const EncryptInputScreen = React.lazy(async () => {
  const {EncryptInput} = await import('./encrypt')
  return {
    default: (_p: StaticScreenProps<EncryptRouteParams>) => <EncryptInput />,
  }
})

const SignInputScreen = React.lazy(async () => {
  const {SignInput} = await import('./sign')
  return {
    default: (_p: StaticScreenProps<CryptoInputRouteParams>) => <SignInput />,
  }
})

const VerifyInputScreen = React.lazy(async () => {
  const {VerifyInput} = await import('./verify')
  return {
    default: (_p: StaticScreenProps<CryptoInputRouteParams>) => <VerifyInput />,
  }
})

const DecryptOutputScreen = React.lazy(async () => {
  const {DecryptOutput} = await import('./decrypt')
  return {
    default: (p: StaticScreenProps<CommonOutputRouteParams>) => <DecryptOutput route={p.route} />,
  }
})

const EncryptOutputScreen = React.lazy(async () => {
  const {EncryptOutput} = await import('./encrypt')
  return {
    default: (p: StaticScreenProps<EncryptOutputRouteParams>) => <EncryptOutput route={p.route} />,
  }
})

const SignOutputScreen = React.lazy(async () => {
  const {SignOutput} = await import('./sign')
  return {
    default: (p: StaticScreenProps<CommonOutputRouteParams>) => <SignOutput route={p.route} />,
  }
})

const VerifyOutputScreen = React.lazy(async () => {
  const {VerifyOutput} = await import('./verify')
  return {
    default: (p: StaticScreenProps<CommonOutputRouteParams>) => <VerifyOutput route={p.route} />,
  }
})

const CryptoTeamBuilderScreen = (p: StaticScreenProps<CryptoTeamBuilderRouteParams>) => {
  const {teamBuilderNonce, teamBuilderUsers: _teamBuilderUsers, ...params} = p.route.params
  return (
    <TeamBuilderScreen
      {...p}
      route={{...p.route, params}}
      onComplete={users => {
        const nextTeamBuilderUsers = [...users].map(({serviceId, username}) => ({serviceId, username}))
        C.Router2.clearModals()
        C.Router2.navigateAppend(
          {
            name: Crypto.encryptTab,
            params: {
              teamBuilderNonce,
              teamBuilderUsers: nextTeamBuilderUsers,
            },
          },
          true
        )
      }}
    />
  )
}

// Output modals dismiss with a "Done" left button on both platforms. We must override
// the default modal options for both: iOS reads unstable_headerLeftItems (a plain headerLeft
// is ignored there), and Android needs headerBackVisible:false to drop the native back arrow.
const doneHeaderOptions =
  (title: string) =>
  ({navigation}: {navigation: {goBack: () => void}}): GetOptionsRet => ({
    ...(isIOS
      ? {
          unstable_headerLeftItems: () => [
            {label: 'Done', onPress: () => navigation.goBack(), type: 'button' as const},
          ],
        }
      : {headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftButton mode="done" {...p} />}),
    headerBackVisible: false,
    headerShown: true,
    title,
  })

export const newRoutes = defineRouteMap({
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
    getOptions: isMobile ? {title: 'Crypto'} : {title: 'Crypto tools'},
    screen: React.lazy(async () => import('./sub-nav')),
  },
})

export const newModalRoutes = defineRouteMap({
  [Crypto.decryptOutput]: {
    getOptions: doneHeaderOptions('Decrypted'),
    screen: DecryptOutputScreen,
  },
  [Crypto.encryptOutput]: {
    getOptions: doneHeaderOptions('Encrypted'),
    screen: EncryptOutputScreen,
  },
  [Crypto.signOutput]: {
    getOptions: doneHeaderOptions('Signed'),
    screen: SignOutputScreen,
  },
  [Crypto.verifyOutput]: {
    getOptions: doneHeaderOptions('Verified'),
    screen: VerifyOutputScreen,
  },
  cryptoTeamBuilder: {
    ...cryptoTeamBuilder,
    screen: CryptoTeamBuilderScreen,
  },
})
