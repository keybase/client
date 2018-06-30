// @flow
import {globalStyles, globalMargins, platformStyles} from '../../styles'
import {memoize} from 'lodash-es'

const rowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
  paddingRight: globalMargins.small,
  paddingLeft: globalMargins.small,
}

const itemBox = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  minWidth: 0,
}

const pathItemIcon = {
  marginRight: globalMargins.small,
}

const pathItemIcon_30 = {
  marginRight: globalMargins.small,
  opacity: 0.3,
}

const rowText = memoize(color =>
  platformStyles({
    common: {
      color,
    },
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  })
)

const rowText_30 = memoize(color =>
  platformStyles({
    common: {
      color,
      opacity: 0.3,
    },
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  })
)

const leftBox = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const rightBox = {
  ...globalStyles.flexBoxRow,
  flexShrink: 1,
  justifyContent: 'flex-end',
  alignItems: 'center',
}

export default {
  rowBox,
  itemBox,
  pathItemIcon,
  pathItemIcon_30,
  rowText,
  rowText_30,
  leftBox,
  rightBox,
}
