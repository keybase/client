// @flow
import React from 'react'
import {PopupDialog} from '../../../common-adapters'

type Props = {
  onClose: () => void,
}

const QuickSearch = ({onClose}: Props) => (
  <PopupDialog onClose={onClose} fill={true}>
    hi
  </PopupDialog>
)

export default QuickSearch
