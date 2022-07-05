import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import CommaSeparatedName from './comma-separated-name'

const getIcon = (tlfType: string): Kb.IconType => {
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
  <Kb.Box style={styles.box}>
    {[
      showTlfTypeIcon && (
        <Kb.Icon
          type={getIcon(pathElements[1])}
          color={Styles.globalColors.blueDark}
          style={styles.iconFolderType}
          key="icon"
        />
      ),
      <Kb.Text key="text" type="BodySmallSemibold">
        {pathElements[1]}
      </Kb.Text>,
      ...pathElements
        .slice(2, includeLast ? undefined : pathElements.length - 1)
        .map((elem, idx) => [
          <Kb.Icon
            key={`icon-${idx}`}
            type="iconfont-arrow-right"
            style={styles.iconArrow}
            color={Styles.globalColors.black_20}
            fontSize={12}
          />,
          <CommaSeparatedName key={`name-${idx}`} type="BodySmallSemibold" name={elem} />,
        ]),
    ]}
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      box: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center',
      },
      iconArrow: {
        alignSelf: 'flex-end',
        paddingLeft: 2,
        paddingRight: 2,
      },
      iconFolderType: {
        marginRight: Styles.globalMargins.xtiny,
      },
    } as const)
)

export default StaticBreadcrumb
