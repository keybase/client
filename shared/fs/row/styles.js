// @flow
import {globalStyles, globalMargins, isMobile, platformStyles} from '../../styles'
import {memoize} from 'lodash-es'

const height = isMobile ? 64 : 40

const rowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
  minHeight: height,
}

const row = {
  ...rowBox,
  paddingLeft: globalMargins.small,
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingRight: globalMargins.small,
}

const itemBox = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'space-between',
  minWidth: 0,
}

const pathItemIcon = {
  marginRight: globalMargins.small,
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

const rightBox = {
  ...globalStyles.flexBoxRow,
  flexShrink: 1,
  justifyContent: 'flex-end',
  alignItems: 'center',
}

const divider = {
  marginLeft: isMobile ? 48 : 48,
}

export default {
  height,
  row,
  rowBox,
  itemBox,
  pathItemIcon,
  rowText,
  divider,
  rightBox,
}
