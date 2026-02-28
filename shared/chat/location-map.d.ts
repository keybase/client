import type * as React from 'react'
type Props = {
  height: number
  mapSrc: string
  onLoad?: () => void
  width: number
}
declare const LocationMap: (p: Props) => React.ReactNode
export default LocationMap
