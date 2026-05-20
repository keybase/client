import type {SizeVector} from './types'

export const fitContainer = (aspectRatio: number, container: SizeVector<number>): SizeVector<number> => {
  'worklet'
  let width = container.width
  let height = container.width / aspectRatio

  if (height > container.height) {
    width = container.height * aspectRatio
    height = container.height
  }

  return {width, height}
}
