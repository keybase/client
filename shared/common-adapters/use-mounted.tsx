import * as React from 'react'

const useMounted = (): (() => boolean) => {
  const mounted = React.useRef(true)
  React.useEffect(
    () => () => {
      mounted.current = false
    },
    []
  )
  return () => mounted.current
}

export default useMounted
