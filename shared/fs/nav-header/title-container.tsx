import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import Title from './title'

type OwnProps = {
  path: Types.Path
  inDestinationPicker?: boolean | null
}

type OwnPropsWithSafeNavigation = Container.PropsWithSafeNavigation<OwnProps>

const mapDispatchToProps = (
  dispatch,
  {inDestinationPicker, safeNavigateAppendPayload}: OwnPropsWithSafeNavigation
) => ({
  onOpenPath: inDestinationPicker
    ? (path: Types.Path) =>
        Constants.makeActionsForDestinationPickerOpen(0, path, safeNavigateAppendPayload).forEach(action =>
          dispatch(action)
        )
    : (path: Types.Path) => dispatch(safeNavigateAppendPayload({path: [{props: {path}, selected: 'main'}]})),
})

const NavHeaderTitleConnected: React.ComponentType<OwnProps> = Container.withSafeNavigation<OwnProps>(
  Container.namedConnect(
    () => ({}),
    mapDispatchToProps,
    (_, d, o: OwnPropsWithSafeNavigation) => ({
      path: o.path || Constants.defaultPath,
      ...d,
    }),
    'NavHeaderTitle'
  )(Title)
)

export default NavHeaderTitleConnected
