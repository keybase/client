// @flow

import * as React from 'react'
import Text from './text'
import BackButton from './back-button'
import Box from './box'
import Icon from './icon'
import ModalHoc, {ModalPositionRelative} from './modal-hoc.desktop'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {findDOMNode} from 'react-dom'
import {withState} from '../util/container'

import type {Props} from './relative-popup-hoc'

class Ref extends React.Component<{setTargetNode: (ref: any) => void, children: React.Element<*>}> {
  componentDidMount() {
    const {setTargetNode} = this.props
    setTargetNode && setTargetNode(findDOMNode(this))
  }

  render() {
    const {children} = this.props
    return React.Children.only(children)
  }
}
type RelativePopupProps = {open: boolean, onClose: () => void}

function RelativePopupHoc(
  TargetComponent: React.ComponentType<{||}>,
  PopupComponent: React.ComponentType<{}>
): React.ComponentType<{}> {
  const ModalPopupComponent = ModalHoc(ModalPositionRelative(PopupComponent))
  return withState('targetNode', 'setTargetNode', null)((props: {}) => {
    return (
      <Box>
        <Ref setTargetNode={props.setTargetNode}>
          <TargetComponent />
        </Ref>
        {true && <ModalPopupComponent targetNode={props.targetNode} />}
      </Box>
    )
  })
}

export default RelativePopupHoc
