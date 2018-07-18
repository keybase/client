// @flow
import * as React from 'react'
import {Box2, Divider, Icon, iconCastPlatformStyles, SectionList, Text} from '../../../common-adapters'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate} from '../../../styles'
import Header from '../header'

type DisplayItem = {currencyCode: string, selected: boolean, symbol: string, type: 'display choice'}
type OtherItem = {
  code: string,
  selected: boolean,
  disabledExplanation: string,
  issuer: string,
  type: 'other choice',
}

type Props = {
  displayChoices: Array<DisplayItem>,
  onChoose: (item: DisplayItem | OtherItem) => void,
  otherChoices: Array<OtherItem>,
}

class ChooseAsset extends React.Component<Props> {
  _renderItem = ({item}: {item: DisplayItem | OtherItem}) => {
    const onClick = () => this.props.onChoose(item)
    switch (item.type) {
      case 'display choice':
        return (
          <DisplayChoice
            currencyCode={item.currencyCode}
            onClick={onClick}
            selected={item.selected}
            symbol={item.symbol}
          />
        )
      case 'other choice':
        return (
          <OtherChoice
            code={item.code}
            disabledExplanation={item.disabledExplanation}
            issuer={item.issuer}
            onClick={onClick}
            selected={item.selected}
          />
        )
      default:
        throw new Error(`ChooseAsset: impossible item type encountered: ${item.type}`)
    }
  }

  _renderSectionHeader = ({section}) => {
    switch (section.key) {
      case 'display choices':
        return (
          <SectionHeader title="Lumens (XLM)" subtitle="Pick your display currency for this transaction:" />
        )
      case 'other choices':
        return <SectionHeader title="Other assets" subtitle="" />
      case 'divider':
        return <Divider />
    }
    return null
  }

  render() {
    const sections = [
      {
        data: this.props.displayChoices.map(dc => ({...dc, key: dc.currencyCode})),
        key: 'display choices',
      },
      ...(this.props.otherChoices.length === 0
        ? []
        : [
            {data: [], key: 'divider'},
            {
              data: this.props.otherChoices.map(oc => ({
                ...oc,
                key: `${oc.code}:${oc.issuer}`,
              })),
              key: 'other choices',
            },
          ]),
    ]
    return (
      <Box2 direction="vertical" style={styles.container}>
        <Header whiteBackground={true} />
        <Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
          <SectionList
            sections={sections}
            renderItem={this._renderItem}
            renderSectionHeader={this._renderSectionHeader}
          />
        </Box2>
      </Box2>
    )
  }
}

type SectionHeaderProps = {
  subtitle: string,
  title: string,
}
const SectionHeader = (props: SectionHeaderProps) => (
  <Box2 direction="vertical" gap="xtiny" gapStart={true} gapEnd={true} style={styles.sectionHeaderContainer}>
    <Text type="BodySmallSemibold">{props.title}</Text>
    {!!props.subtitle && <Text type="BodySmall">{props.subtitle}</Text>}
  </Box2>
)

type DisplayChoiceProps = {
  currencyCode: string,
  onClick: () => void,
  selected: boolean,
  symbol: string,
}
const DisplayChoice = (props: DisplayChoiceProps) => (
  <Box2
    direction="horizontal"
    style={styles.choiceContainer}
    fullWidth={true}
    gap="small"
    gapStart={true}
    gapEnd={true}
  >
    <Text type="Body" style={props.selected ? styles.blue : undefined}>
      {props.symbol === 'XLM' ? 'Purely strictly ' : 'Lumens (XLM) displayed as '}
      <Text type="BodyExtrabold" style={props.selected ? styles.blue : undefined}>
        {props.currencyCode} ({props.symbol})
      </Text>
    </Text>
    <Box2 direction="horizontal" style={styles.spacer} />
    {props.selected && (
      <Icon
        type="iconfont-check"
        color={globalColors.blue}
        style={iconCastPlatformStyles(styles.checkIcon)}
      />
    )}
  </Box2>
)

type OtherChoiceProps = {
  code: string,
  disabledExplanation: string,
  issuer: string,
  onClick: () => void,
  selected: boolean,
}
const OtherChoice = (props: OtherChoiceProps) => (
  <Box2
    direction="horizontal"
    style={styles.choiceContainer}
    fullWidth={true}
    gap="small"
    gapStart={true}
    gapEnd={true}
  >
    <Box2 direction="vertical">
      <Text
        type="Body"
        style={collapseStyles([props.selected && styles.blue, !!props.disabledExplanation && styles.grey])}
      >
        <Text
          type="BodyExtrabold"
          style={collapseStyles([props.selected && styles.blue, !!props.disabledExplanation && styles.grey])}
        >
          {props.code}
        </Text>/{props.issuer}
      </Text>
      {!!props.disabledExplanation && (
        <Text type="BodySmall" style={styles.grey}>
          {props.disabledExplanation}
        </Text>
      )}
    </Box2>
    <Box2 direction="horizontal" style={styles.spacer} />
    {props.selected && (
      <Icon
        type="iconfont-check"
        color={globalColors.blue}
        style={iconCastPlatformStyles(styles.checkIcon)}
      />
    )}
  </Box2>
)

const styles = styleSheetCreate({
  blue: {
    color: globalColors.blue,
  },
  checkIcon: {
    alignSelf: 'flex-end',
  },
  choiceContainer: {
    alignItems: 'center',
    height: 40,
  },
  container: {
    width: 360,
  },
  grey: {
    color: globalColors.black_40,
  },
  listContainer: {
    maxHeight: 525 - 48,
  },
  sectionHeaderContainer: {
    alignItems: 'flex-start',
    backgroundColor: globalColors.white,
    height: 40,
    justifyContent: 'center',
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
  },
  spacer: {
    flex: 1,
  },
})

export default ChooseAsset
