import * as React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Icon, Text, IconType} from '../../common-adapters'
import CommaSeparatedName from './comma-separated-name'

const getIcon = (tlfType: string): IconType => {
  switch (tlfType) {
    case 'private':
      return 'icon-folder-private-16'
    case 'public':
      return 'icon-folder-public-16'
    case 'team':
      return 'icon-folder-team-16'
    default:
      return 'iconfont-question-mark'
  }
}

type Props = {
  pathElements: Array<string>
  showTlfTypeIcon?: boolean
  includeLast?: boolean
}

const StaticBreadcrumb = ({pathElements, showTlfTypeIcon, includeLast}: Props) => (
  <Box style={stylesBox}>
    {[
      showTlfTypeIcon && (
        <Icon
          type={getIcon(pathElements[1])}
          color={globalColors.blueDark}
          style={stylesIconFolderType}
          key="icon"
        />
      ),
      <Text key="text" type="BodySmallSemibold">
        {pathElements[1]}
      </Text>,
      ...pathElements
        .slice(2, includeLast ? undefined : pathElements.length - 1)
        .map((elem, idx) => [
          <Icon
            key={`icon-${idx}`}
            type="iconfont-arrow-right"
            style={stylesIconArrow}
            color={globalColors.black_20}
            fontSize={12}
          />,
          <CommaSeparatedName key={`name-${idx}`} type="BodySmallSemibold" name={elem} />,
        ]),
    ]}
  </Box>
)

const stylesBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const stylesIconFolderType = {
  marginRight: globalMargins.xtiny,
}

const stylesIconArrow = {
  alignSelf: 'flex-end',
  paddingLeft: 2,
  paddingRight: 2,
} as const

export default StaticBreadcrumb
