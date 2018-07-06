// @flow
import * as React from 'react'
import {platformStyles, styleSheetCreate, collapseStyles} from '../../../styles'
import type {Props} from './qr-image'

const QRImage = (props: Props) => (
  <div style={collapseStyles([styles.code, {backgroundImage: `url("${props.url}")`}])} />
)

const styles = styleSheetCreate({
  code: platformStyles({
    isElectron: {
      // weird offsets is cause the genration code puts some extra margin on it we don't want
      backgroundPosition: '-24px -24px',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '248px 248px',
      height: 64,
      imageRendering: 'pixelated',
      width: 64,
    },
  }),
})

export default QRImage
