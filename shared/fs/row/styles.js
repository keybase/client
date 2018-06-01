// @flow
import {globalStyles, globalMargins, isMobile, platformStyles} from '../../styles'
import {memoize} from 'lodash-es'

const rowBox = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  isMobile: {
    minHeight: 64,
  },
  isElectron: {
    minHeight: 40,
  },
})

const row = {
  ...rowBox,
  paddingLeft: globalMargins.small,
  justifyContent: 'space-between',
  paddingRight: globalMargins.small,
}

const itemBox = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
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
  row,
  rowBox,
  itemBox,
  pathItemIcon,
  rowText,
  divider,
  rightBox,
}
