// @flow
import * as React from 'react'
import type {RouteProps} from '../../../../route-tree/render-route'
import PopupMenu, {ModalLessPopupMenu, type MenuItem} from '../../../../common-adapters/popup-menu'
import {connect, isMobile} from '../../../../util/container'

type OwnProps = {
  navigateUp: () => any,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}: OwnProps) => ({
  onHidden: () => dispatch(navigateUp()),
})

export type Props = RouteProps<
  {
    items: Array<MenuItem | 'Divider' | null>,
  },
  {}
> & {
  onHidden: () => void,
}

const RetentionDropdown = (props: Props) => {
  const {routeProps, onHidden} = props
  const items = routeProps.get('items')
  return isMobile ? (
    <PopupMenu items={items} onHidden={onHidden} style={{overflow: 'visible'}} />
  ) : (
    <ModalLessPopupMenu
      closeOnClick={true}
      items={items}
      onHidden={onHidden}
      style={{overflow: 'visible', width: 220}}
    />
  )
}

export default connect(undefined, mapDispatchToProps)(RetentionDropdown)
