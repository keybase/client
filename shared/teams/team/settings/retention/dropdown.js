// @flow
import * as React from 'react'
import type {RouteProps} from '../../../../route-tree/render-route'
import PopupMenu, {ModalLessPopupMenu, type MenuItem} from '../../../../common-adapters/popup-menu'
import {connect, isMobile} from '../../../../util/container'

type OwnProps = RouteProps<
  {
    items: Array<MenuItem | 'Divider' | null>,
  },
  {}
> & {
  navigateUp: () => any,
}

const mapStateToProps = (state, {routeProps}: OwnProps) => ({
  items: routeProps.get('items'),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}: OwnProps) => ({
  onHidden: () => dispatch(navigateUp()),
})

export type Props = {
  items: Array<MenuItem | 'Divider' | null>,
  onHidden: () => void,
}

const RetentionDropdown = (props: Props) => {
  const {items, onHidden} = props
  return isMobile ? (
    <PopupMenu items={items} onHidden={onHidden} style={{overflow: 'visible'}} />
  ) : (
    <ModalLessPopupMenu
      // closeOnClick={true}
      items={items}
      onHidden={onHidden}
      style={{overflow: 'visible', width: 220}}
    />
  )
}

export {RetentionDropdown as RetentionDropdownView}
export default connect(mapStateToProps, mapDispatchToProps)(RetentionDropdown)
