import * as React from 'react'
/** A tiny version of react-native-web to use react-navigation */
export const View = p => <div style={p.style}>{p.children}</div>

// export {Animated} from 'react-native/Libraries/Animated/src/Animated.js'
export const Animated = {
  add: (a, b) => ({value: a.value + b.value}),
  multiply: (a, b) => ({value: a.value * b.value}),
}

export const Platform = {
  select: o => {
    if (o.default) return o.default
    if (o.web) return o.web
    if (o.desktop) return o.desktop
    return o.ios
  },
}

export const requireNativeComponent = c => () => null
export const UIManager = {
  getViewManagerConfig: () => null,
}

export const StyleSheet = {
  create: o => o,
}

export const Easing = {
  bezier: f => f,
  in: f => f,
  out: f => f,
  poly: f => f,
}
