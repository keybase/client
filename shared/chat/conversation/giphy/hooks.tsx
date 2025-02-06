import * as C from '@/constants'

export const useHooks = () => {
  const giphy = C.useChatContext(s => s.giphyResult)
  const onClick = C.useChatContext(s => s.dispatch.giphySend)
  return {
    galleryURL: giphy?.galleryUrl ?? '',
    onClick,
    previews: giphy?.results ?? undefined,
  }
}
