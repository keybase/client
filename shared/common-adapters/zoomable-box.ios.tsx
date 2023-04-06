import ScrollView from './scroll-view'
import type {Props} from './zoomable-box'

const Kb = {
  ScrollView,
}

export const ZoomableBox = (props: Props) => (
  <Kb.ScrollView
    centerContent={true}
    alwaysBounceVertical={false}
    bounces={props.bounces}
    children={props.children}
    contentContainerStyle={props.contentContainerStyle}
    indicatorStyle="white"
    maximumZoomScale={props.maxZoom || 3}
    minimumZoomScale={props.minZoom || 1}
    onScroll={e =>
      props.onZoom?.({
        // @ts-ignore misses rn types
        height: e.nativeEvent.contentSize.height,
        // @ts-ignore misses rn types
        width: e.nativeEvent.contentSize.width,
        // @ts-ignore misses rn types
        x: e.nativeEvent.contentOffset.x,
        // @ts-ignore misses rn types
        y: e.nativeEvent.contentOffset.y,
      })
    }
    scrollEventThrottle={16}
    scrollsToTop={false}
    showsHorizontalScrollIndicator={props.showsHorizontalScrollIndicator}
    showsVerticalScrollIndicator={props.showsVerticalScrollIndicator}
    style={props.style}
  />
)
