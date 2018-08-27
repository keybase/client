// @flow
import * as React from 'react'
import {Image} from 'react-native'

// Simple wrapper around Image that forces android to not fade

class NativeImage extends React.Component<React.ElementProps<typeof Image>> {
  static getSize = Image.getSize
  render() {
    return <Image {...this.props} fadeDuration={0} />
  }
}

export default NativeImage
