import * as React from 'react'
import * as Shared from './shim.shared'
import * as Container from '../util/container'
import * as Styles from '../styles'
import {PerfWrapper} from '../util/use-perf'

export const shim = (routes: any) => Shared.shim(routes, shimNewRoute)

const shimNewRoute = (Original: any) => {
  const ShimmedNew = React.memo((props: any) => {
    const original = <Original {...props} />
    let body = original

    const renderDebug = Shared.getRenderDebug()
    if (renderDebug) {
      body = <PerfWrapper style={styles.perf}>{original}</PerfWrapper>
    }

    return body
  })
  Container.hoistNonReactStatic(ShimmedNew, Original)
  return ShimmedNew
}

const styles = Styles.styleSheetCreate(() => ({
  perf: {
    height: '100%',
    width: '100%',
  },
}))
