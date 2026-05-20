import type {SizeVector} from '../../types'

type Options = {
  crop: SizeVector<number>
  resolution: SizeVector<number>
  angle: number
}

export const getRatioSize = (
  aspectRatio: number,
  container: Partial<SizeVector<number>>
): SizeVector<number> => {
  'worklet'
  if (container.width !== undefined) {
    return {width: container.width, height: container.width / aspectRatio}
  }
  return {width: container.height! * aspectRatio, height: container.height!}
}

export const getCropRotatedSize = (options: Options): SizeVector<number> => {
  'worklet'
  const {crop, angle, resolution} = options
  const cropAspectRatio = crop.width / crop.height
  let base = crop

  const flipped = angle % Math.PI === 0
  const aspectRatio = resolution.width / resolution.height
  const inverseAspectRatio = resolution.height / resolution.width

  const currentAspectRatio = flipped ? aspectRatio : inverseAspectRatio
  base = getRatioSize(currentAspectRatio, {
    width: cropAspectRatio >= 1 ? undefined : crop.width,
    height: cropAspectRatio >= 1 ? crop.height : undefined,
  })

  let sizeModifier = 1
  if (base.height < crop.height) sizeModifier = crop.height / base.height
  if (base.width < crop.width) sizeModifier = crop.width / base.width
  base.width = base.width * sizeModifier
  base.height = base.height * sizeModifier

  const maxWidth = Math.abs(base.height * Math.sin(angle)) + Math.abs(base.width * Math.cos(angle))
  const maxHeight = Math.abs(base.height * Math.cos(angle)) + Math.abs(base.width * Math.sin(angle))

  return getRatioSize(aspectRatio, {
    width: aspectRatio >= 1 ? undefined : maxWidth,
    height: aspectRatio >= 1 ? maxHeight : undefined,
  })
}
