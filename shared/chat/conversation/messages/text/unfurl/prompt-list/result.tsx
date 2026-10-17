import * as T from '@/constants/types'

export const promptResult = (domain: string, accept: boolean, remember: boolean): T.RPCChat.UnfurlPromptResult => {
  if (accept) {
    return remember
      ? {accept: domain, actionType: T.RPCChat.UnfurlPromptAction.accept}
      : {actionType: T.RPCChat.UnfurlPromptAction.onetime, onetime: domain}
  }
  return remember
    ? {actionType: T.RPCChat.UnfurlPromptAction.block, block: domain}
    : {actionType: T.RPCChat.UnfurlPromptAction.notnow}
}
