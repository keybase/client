import * as React from 'react'
/** A tiny version of react-native-web to use react-navigation */
export const View = React.forwardRef((p, ref) => (
  <div ref={ref} style={p.style}>
    {p.children}
  </div>
))
export const ScrollView = p => <div style={p.style}>{p.children}</div>
export const Switch = p => null
export const TextInput = p => null
export const DrawerLayoutAndroid = p => null
export const FlatList = p => null
export const Touchable = React.forwardRef((p, ref) => (
  <div ref={ref} style={p.style}>
    {p.children}
  </div>
))
Touchable.TOUCH_TARGET_DEBUG = false

export const I18nManager = {
  isRTL: false,
}

export const Dimensions = {
  get: s => 0,
}

export const StatusBar = {
  currentHeight: 0,
}

class Value {
  value: number
  constructor(v: any) {
    this.value = v
  }
  getValue() {
    return this.value
  }
  setValue(v: any) {
    this.value = v
  }
  interpolate(o: any) {
    // TODO fix
    return new Value(o.outputRange[o.outputRange.length - 1])
  }
}

// export {Animated} from 'react-native/Libraries/Animated/src/Animated.js'
export const Animated = {
  Value,
  View,
  add: (a, b) => ({value: a.value + b.value}),
  createAnimatedComponent: C => C,
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

export const NativeModules = {}

export const requireNativeComponent = c => () => null
export const UIManager = {
  getViewManagerConfig: () => null,
}

const flattenStyle = s => {
  if (!s) {
    return undefined
  }

  if (!Array.isArray(s)) {
    return s
  }

  return s.reduce((obj, v) => {
    const inner = flattenStyle(v)
    if (inner) {
      for (const key in inner) {
        obj[key] = inner[key]
      }
    }
    return obj
  }, {})
}

export const StyleSheet = {
  create: o => o,
  flatten: s => flattenStyle(s),
}

export const Easing = {
  bezier: f => f,
  in: f => f,
  out: f => f,
  poly: f => f,
}
