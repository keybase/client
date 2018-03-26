// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {Box, Text} from '../../common-adapters'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu'
import PathItemIcon from '../common/path-item-icon'
import Progress from '../common/progress'
import memoize from 'lodash/memoize'

type Props = {
  name: string,
  intent: Types.TransferIntent,
  itemStyles: Types.ItemStyles,
  completePortion: number,
  progressText: string,
  error?: string,
  onHidden: () => void,
}

const getTitle = (intent: Types.TransferIntent): string => {
  switch (intent) {
    case 'camera-roll':
      return 'Saving to camera roll...'
    case 'share':
      return 'Preparing to share...'
    case 'none':
      return ''
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(intent: empty) // this breaks when a new intent is added but not handled here
      return ''
  }
}

const TransferPopup = (props: Props) => {
  const header = {
    title: 'unused',
    view: (
      <Box style={stylesHeader}>
        <Text type="BodySemibold">{getTitle(props.intent)}</Text>
        <PathItemIcon spec={props.itemStyles.iconSpec} style={stylesPathItemIcon} />
        <Text type="BodySmallSemibold" style={{color: props.itemStyles.textColor}} lineClamp={1}>
          {props.name}
        </Text>
        <Box style={stylesProgressContainer(!!props.error)}>
          <Progress completePortion={props.completePortion} text={props.progressText} width={96} />
        </Box>
      </Box>
    ),
  }
  return <ModalLessPopupMenu header={header} items={[]} style={stylesContainer} onHidden={props.onHidden} />
}

const stylesPathItemIcon = {
  marginTop: globalMargins.medium,
}

const stylesHeader = {
  ...globalStyles.flexBoxColumn,
  width: '100%',
  alignItems: 'center',
  paddingTop: globalMargins.small,
}

const stylesContainer = {
  width: '100%',
  overflow: 'visible',
}

const stylesProgressContainer = memoize((errored: boolean) => ({
  ...globalStyles.flexBoxColumn,
  marginTop: globalMargins.small,
  width: '100%',
  height: 48,
  backgroundColor: errored ? globalColors.red : globalColors.green,
  alignItems: 'center',
  paddingTop: globalMargins.small,
}))

export default TransferPopup
