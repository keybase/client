import * as React from 'react'
import type * as Types from '../../constants/types/fs'

type OwnProps = {route: {params: {path: Types.Path}}}

const BarePreview = React.lazy(async () => {
  const {BarePreview} = await import('.')
  return {default: BarePreview}
})
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <BarePreview {...p.route.params} />
  </React.Suspense>
)
const getScreen = () => Screen

export default {barePreview: {getScreen}}
