// @flow
import * as React from 'react'
import {
  Box2,
  ClickableBox,
  Divider,
  Icon,
  iconCastPlatformStyles,
  MaybePopup,
  SectionList,
  Text,
} from '../../../common-adapters'
import {collapseStyles, globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../../styles'
import Header from '../header'

const unexpandedNumDisplayOptions = 4

export type DisplayItem = {currencyCode: string, selected: boolean, symbol: string, type: 'display choice'}
export type OtherItem = {
  code: string,
  selected: boolean,
  disabledExplanation: string,
  issuer: string,
  type: 'other choice',
}
type ExpanderItem = {
  onClick: () => void,
  text: string,
  type: 'expander',
}

export type Props = {
  displayChoices: Array<DisplayItem>,
  onBack: () => void,
  onChoose: (item: DisplayItem | OtherItem) => void,
  otherChoices: Array<OtherItem>,
  selected: String,
}

type State = {
  expanded: boolean,
}

class ChooseAsset extends React.Component<Props, State> {
  state = {expanded: false}

  _renderItem = ({
    item,
  }: {
    item: (DisplayItem & {key: string}) | (OtherItem & {key: string}) | (ExpanderItem & {key: string}),
  }) => {
    switch (item.type) {
      case 'display choice':
        return (
          <DisplayChoice
            key={item.key}
            currencyCode={item.currencyCode}
            onClick={() => this.props.onChoose(item)}
            selected={item.selected}
            symbol={item.symbol}
          />
        )
      case 'other choice':
        return (
          <OtherChoice
            key={item.key}
            code={item.code}
            disabledExplanation={item.disabledExplanation}
            issuer={item.issuer}
            onClick={() => this.props.onChoose(item)}
            selected={item.selected}
          />
        )
      case 'expander':
        return (
          <ClickableBox key={item.key} onClick={item.onClick}>
            <Box2 direction="horizontal" style={styles.choiceContainer}>
              <Box2 direction="horizontal" centerChildren={true} style={styles.expanderContainer}>
                <Text type="BodySmallSemibold" style={styles.expanderText}>
                  {item.text}
                </Text>
              </Box2>
            </Box2>
          </ClickableBox>
        )
      default:
        throw new Error(`ChooseAsset: impossible item type encountered: ${item.type}`)
    }
  }

  _renderSectionHeader = ({section}) => {
    switch (section.key) {
      case 'display choices':
        return (
          <SectionHeader
            key={section.key}
            title="Lumens (XLM)"
            subtitle="Pick your display currency for this transaction:"
          />
        )
      case 'other choices':
        return <SectionHeader key={section.key} title="Other assets" subtitle="" />
      case 'divider':
        return <Divider key={section.key} />
    }
    return null
  }

  render() {
    const displayChoicesData = this.props.displayChoices && this.props.displayChoices
      .slice(0, this.state.expanded ? this.props.displayChoices.length : unexpandedNumDisplayOptions)
      .map(dc => ({...dc, key: dc.currencyCode}))
    if (this.props.displayChoices && !this.state.expanded) {
      displayChoicesData.push({
        key: 'expander',
        onClick: () => this.setState({expanded: true}),
        text: `+${this.props.displayChoices.length - unexpandedNumDisplayOptions} display currencies`,
        type: 'expander',
      })
    }
    if (!displayChoicesData.find(c => c.currencyCode === 'XLM')) {
      displayChoicesData.unshift({
        key: 'XLM',
        currencyCode: 'XLM',
        selected: this.props.selected === 'XLM',
        symbol: 'XLM',
        type: 'display choice',
      })
    }
    const sections = [
      {
        data: displayChoicesData,
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
      <MaybePopup onClose={this.props.onClose}>
        <Box2 direction="vertical" style={styles.container}>
          <Header onBack={this.props.onBack} whiteBackground={true} />
          <Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
            <SectionList
              sections={sections}
              renderItem={this._renderItem}
              renderSectionHeader={this._renderSectionHeader}
            />
          </Box2>
        </Box2>
      </MaybePopup>
    )
  }
}

type SectionHeaderProps = {
  subtitle: string,
  title: string,
}
const SectionHeader = (props: SectionHeaderProps) => (
  <Box2
    direction="vertical"
    fullWidth={true}
    gap="xtiny"
    gapStart={true}
    gapEnd={true}
    style={styles.sectionHeaderContainer}
  >
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
  <ClickableBox hoverColor={globalColors.blue4} onClick={props.onClick}>
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
  </ClickableBox>
)

type OtherChoiceProps = {
  code: string,
  disabledExplanation: string,
  issuer: string,
  onClick: () => void,
  selected: boolean,
}
const OtherChoice = (props: OtherChoiceProps) => (
  <ClickableBox
    hoverColor={!props.disabledExplanation ? globalColors.blue4 : null}
    onClick={!props.disabledExplanation ? props.onClick : null}
  >
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
            style={collapseStyles([
              props.selected && styles.blue,
              !!props.disabledExplanation && styles.grey,
            ])}
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
  </ClickableBox>
)

const styles = styleSheetCreate({
  blue: {
    color: globalColors.blue,
  },
  checkIcon: platformStyles({
    isMobile: {
      position: 'absolute',
      right: 16,
      top: 12,
    },
  }),
  choiceContainer: {
    alignItems: 'center',
    height: 40,
    // needed to get on top of absolutely positioned background color
    position: 'relative',
  },
  container: platformStyles({
    isElectron: {
      height: 525,
      width: 360,
    },
    isMobile: {
      width: '100%',
    },
  }),
  expanderContainer: {
    backgroundColor: globalColors.black_05,
    borderRadius: 11,
    height: 22,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
  },
  expanderText: {color: globalColors.black_60},
  grey: {
    color: globalColors.black_40,
  },
  listContainer: platformStyles({
    common: {
      paddingTop: globalMargins.tiny,
    },
    isElectron: {
      maxHeight: 525 - 48,
    },
  }),
  sectionHeaderContainer: platformStyles({
    common: {
      alignItems: 'flex-start',
      backgroundColor: globalColors.white,
      justifyContent: 'center',
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
    },
    isElectron: {
      // must be uniform height with current SectionList implementation
      // so first doesn't peek out from under the second
      height: 40,
    },
  }),
  spacer: {
    flex: 1,
  },
})

export default ChooseAsset
