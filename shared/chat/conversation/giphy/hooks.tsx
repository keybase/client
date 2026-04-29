import * as InputState from '../input-area/input-state'

export const useHooks = () => {
  const giphy = InputState.useConversationInput(s => s.giphyResult)
  const onClick = InputState.useConversationInputDispatch(s => s.sendGiphyResult)
  return {
    galleryURL: giphy?.galleryUrl ?? '',
    onClick,
    previews: giphy?.results ?? undefined,
  }
}
