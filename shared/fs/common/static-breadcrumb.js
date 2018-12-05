// @flow
import * as React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Icon, Text, type IconType} from '../../common-adapters'

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
  pathElements: Array<string>,
  showTlfTypeIcon?: boolean,
  includeLast?: boolean,
}

const StaticBreadcrumb = ({pathElements, showTlfTypeIcon, includeLast}: Props) => (
  <Box style={stylesBox}>
    {[
      showTlfTypeIcon && (
        <Icon
          type={getIcon(pathElements[1])}
          color={globalColors.blue}
          style={stylesIconFolderType}
          key="icon"
        />
      ),
      <Text key="text" type="BodySmallSemibold">
        {pathElements[1]}
      </Text>,
      ...pathElements.slice(2, includeLast ? undefined : pathElements.length - 1).map((elem, idx) => [
        <Icon
          key={`icon-${idx}`}
          type="iconfont-arrow-right"
          style={stylesIconArrow}
          color={globalColors.black_20}
          fontSize={12}
        />,

        // TODO: make this into a component.
        // We are splitting on ',' here, so it won't work for
        // long names that don't have comma. If this becomes a
        // problem, we might have to do smarter splitting that
        // involve other characters, or just break the long name
        // apart into 3-character groups.
        ...elem.split(',').map((sub, idxSub, {length}) => (
          <Text key={`text-${idx}-${idxSub}`} type="BodySmallSemibold">
            {sub}
            {idxSub !== length - 1 ? ',' : ''}
          </Text>
        )),
        /*
        <Text key={`text-${idx}`} type="BodySmallSemibold">
          {elem}
        </Text>,
        */
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
}

export default StaticBreadcrumb
