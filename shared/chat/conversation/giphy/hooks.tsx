import * as Chat from '@/constants/chat2'

export const useHooks = () => {
  const giphy = Chat.useChatContext(s => s.giphyResult)
  const onClick = Chat.useChatContext(s => s.dispatch.giphySend)
  return {
    galleryURL: giphy?.galleryUrl ?? '',
    onClick,
    previews: giphy?.results ?? undefined,
  }
}
