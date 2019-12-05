import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Container from '../../../util/container'
import OpenHOC from '../../common/open-hoc'
import TlfType from './tlf-type'

type OwnProps = {
  destinationPickerIndex?: number
  name: Types.TlfType
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  Container.connect(
    () => ({}),
    () => ({}),
    (_, __, {name, destinationPickerIndex}: OwnProps) => {
      const path = Types.stringToPath(`/keybase/${name}`)
      return {
        destinationPickerIndex,
        name,
        path,
      }
    }
  )(OpenHOC(ComposedComponent)))(TlfType)
