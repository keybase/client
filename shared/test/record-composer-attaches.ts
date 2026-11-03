/// <reference types="jest" />
import type {ComposerInput, makeComposer} from '@/chat/conversation/input-area/composer'

// Records every input a view of the composers made from now on attaches (and null for every
// detach), by wrapping the real makeComposer; restored with the other mocks.
export const recordComposerAttaches = (composerModule: {makeComposer: typeof makeComposer}) => {
  const attaches: Array<ComposerInput | null> = []
  const actual = composerModule.makeComposer
  jest.spyOn(composerModule, 'makeComposer').mockImplementation(deps => {
    const composer = actual(deps)
    return {
      ...composer,
      connect: () => {
        const view = composer.connect()
        return {
          ...view,
          setInput: input => {
            attaches.push(input)
            view.setInput(input)
          },
        }
      },
    }
  })
  return attaches
}
