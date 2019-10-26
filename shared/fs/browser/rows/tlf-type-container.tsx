import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Container from '../../../util/container'
import OpenHOC from '../../common/open-hoc'
import TlfType from './tlf-type'

type OwnProps = {
  destinationPickerIndex?: number
  name: Types.TlfType
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  Container.connect(
    (state: Container.TypedState, {name}: OwnProps) => ({
      _tlfList: Constants.getTlfListFromType(state.fs.tlfs, name),
    }),
    () => ({}),
    (stateProps, _, {name, destinationPickerIndex}: OwnProps) => {
      const badgeCount = Constants.computeBadgeNumberForTlfList(stateProps._tlfList)
      const path = Types.stringToPath(`/keybase/${name}`)
      return {
        badgeCount,
        destinationPickerIndex,
        name,
        path,
      }
    }
  )(OpenHOC(ComposedComponent)))(TlfType)
