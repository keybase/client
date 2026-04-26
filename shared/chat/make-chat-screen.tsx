import type {GetOptionsRet, RouteDef} from '@/constants/types/router'
import type * as T from '@/constants/types'
import {ProviderScreen} from '@/stores/convostate'
import type {StaticScreenProps} from '@react-navigation/core'
import type {ComponentProps, LazyExoticComponent, ReactElement} from 'react'

// See constants/router.tsx IsExactlyRecord for explanation
type IsExactlyRecord<T> = string extends keyof T ? true : false

type NavigatorParamsFromProps<P> =
  P extends Record<string, unknown>
    ? IsExactlyRecord<P> extends true
      ? undefined
      : keyof P extends never
        ? undefined
        : P
    : undefined

type AddConversationIDKey<P> =
  P extends Record<string, unknown>
    ? Omit<P, 'conversationIDKey'> & {conversationIDKey?: T.Chat.ConversationIDKey}
    : {conversationIDKey?: T.Chat.ConversationIDKey}

type LazyInnerComponent<COM extends LazyExoticComponent<any>> =
  COM extends LazyExoticComponent<infer Inner> ? Inner : never

type ChatScreenParams<COM extends LazyExoticComponent<any>> = NavigatorParamsFromProps<
  AddConversationIDKey<ComponentProps<LazyInnerComponent<COM>>>
>

type ChatScreenProps<COM extends LazyExoticComponent<any>> = StaticScreenProps<ChatScreenParams<COM>>
type ChatScreenComponent<COM extends LazyExoticComponent<any>> = (
  p: ChatScreenProps<COM>
) => ReactElement

export function makeChatScreen<COM extends LazyExoticComponent<any>>(
  Component: COM,
  options?: {
    getOptions?: GetOptionsRet | ((props: ChatScreenProps<COM>) => GetOptionsRet)
    skipProvider?: boolean
    canBeNullConvoID?: boolean
  }
): RouteDef<ChatScreenComponent<COM>, ChatScreenParams<COM>> {
  const getOptionsOption = options?.getOptions
  const getOptions =
    typeof getOptionsOption === 'function'
      ? (p: ChatScreenProps<COM>) =>
          // getOptions can run before params are materialized on the route object.
          getOptionsOption({
            ...p,
            route: {
              ...p.route,
              params: ((p.route as {params?: ChatScreenParams<COM>}).params ?? {}) as ChatScreenParams<COM>,
            },
          })
      : getOptionsOption
  return {
    ...options,
    getOptions,
    screen: function Screen(p: ChatScreenProps<COM>) {
      const Comp = Component as any
      const params = ((p.route as {params?: ChatScreenParams<COM>}).params ?? {}) as ChatScreenParams<COM>
      const providerConversationIDKey = (
        params as {conversationIDKey?: T.Chat.ConversationIDKey | undefined}
      ).conversationIDKey
      return options?.skipProvider ? (
        <Comp {...params} />
      ) : (
        <ProviderScreen
          rp={{
            route: {
              params:
                providerConversationIDKey === undefined
                  ? {}
                  : {conversationIDKey: providerConversationIDKey},
            },
          }}
          {...(options?.canBeNullConvoID === undefined ? {} : {canBeNull: options.canBeNullConvoID})}
        >
          <Comp {...params} />
        </ProviderScreen>
      )
    },
  }
}
