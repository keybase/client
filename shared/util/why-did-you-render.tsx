/// <reference types="@welldone-software/why-did-you-render" />
import enabled from './why-did-you-render-enabled'
if (enabled && __DEV__) {
  const Platform = (require('react-native') as {Platform: {OS: string}}).Platform
  // react-scan doesn't work on RN yet
  if (Platform.OS === 'web') {
    logger.debug('react-scan loading')
    const scan = (
      require('react-scan') as
        | {scan: (o: {enabled: boolean; log: boolean; renderCountThreshold: number}) => void}
        | undefined
    )?.scan
    if (scan && typeof scan === 'function') {
      try {
        scan({enabled: true, log: true, renderCountThreshold: 1})
        console.log('\n\n\nDEBUG: react-scan enabled')
      } catch {}
    }
  } else {
    console.log('\n\n\nDEBUG: WHY DID YOU RENDER try to load')
    const whyDidYouRender = require('@welldone-software/why-did-you-render') as
      | undefined
      | ((r: unknown, o: unknown) => void)
    if (whyDidYouRender && typeof whyDidYouRender === 'function') {
      try {
        whyDidYouRender(require('react'), {
          // TODO reduce these
          exclude: [
            /^Pressable$/,
            /^Portal$/,
            /^RNSScreen$/,
            /^Screen$/,
            /^Group$/,
            /^View$/,
            /^AnimatedComponentWrapper$/,
            /^CardContainer$/,
            /^StaticContainer$/,
            /^PressabilityDebugView$/,
            /^PreventRemoveProvider$/,
            /^NativeStackViewInner$/,
            /^OrdinalWaypoint/, // ignore useIntersection hook for now
            /^LeftTabNavigator/,
            /^RouteBox/,
          ],
          include: [
            // uncomment to watch everything, realllllly slows things down
            // /.*/,
          ],
          // logOnDifferentValues: false,
          trackAllPureComponents: true,
        })
        console.log('\n\n\nDEBUG: WHY DID YOU RENDER enabled')
      } catch {}
    }
  }
}

export {}
