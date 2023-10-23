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
    maximumZoomScale={props.maxZoom || 10}
    minimumZoomScale={props.minZoom || 1}
    onScroll={e =>
      props.onZoom?.({
        height: e.nativeEvent?.contentSize.height ?? 0,
        scale: e.nativeEvent?.zoomScale ?? 0,
        width: e.nativeEvent?.contentSize.width ?? 0,
        x: e.nativeEvent?.contentOffset.x ?? 0,
        y: e.nativeEvent?.contentOffset.y ?? 0,
      })
    }
    scrollEventThrottle={16}
    scrollsToTop={false}
    showsHorizontalScrollIndicator={props.showsHorizontalScrollIndicator}
    showsVerticalScrollIndicator={props.showsVerticalScrollIndicator}
    style={props.style}
    zoomScale={props.zoomScale}
    onLayout={props.onLayout}
  />
)
