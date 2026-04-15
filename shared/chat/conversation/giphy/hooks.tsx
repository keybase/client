import * as ConvoState from '@/stores/convostate'

export const useHooks = () => {
  const giphy = ConvoState.useChatUIContext(s => s.giphyResult)
  const onClick = ConvoState.useChatContext(s => s.dispatch.giphySend)
  return {
    galleryURL: giphy?.galleryUrl ?? '',
    onClick,
    previews: giphy?.results ?? undefined,
  }
}
