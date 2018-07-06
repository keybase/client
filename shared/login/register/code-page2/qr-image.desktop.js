// @flow
import * as React from 'react'
import {platformStyles, styleSheetCreate, collapseStyles} from '../../../styles'
import type {Props} from './qr-image'

const QRImage = (props: Props) => <img src={props.url} style={styles.code} />

const styles = styleSheetCreate({
  code: platformStyles({
    isElectron: {
      alignSelf: 'center',
      imageRendering: 'pixelated',
    },
  }),
})

export default QRImage
