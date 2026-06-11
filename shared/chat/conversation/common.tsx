import * as Kb from '@/common-adapters'
import type {zoomImage} from '@/constants/chat/helpers'

type ZoomedImageSizing = ReturnType<typeof zoomImage>

// Thumbnail cropped to a fixed box: the outer box clips, the inner box uses
// zoomImage's negative margins to center the overflowing image.
export const ZoomedImage = (p: {src: string; sizing?: ZoomedImageSizing}) => (
  <Kb.Box2 direction="vertical" overflow="hidden" relative={true}>
    <Kb.Box2 direction="vertical" style={p.sizing?.margins}>
      <Kb.Image src={p.src} style={p.sizing?.dims} />
    </Kb.Box2>
  </Kb.Box2>
)
