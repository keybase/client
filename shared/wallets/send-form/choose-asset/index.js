// @flow
import * as React from 'react'
import {Box2, SectionList, Text} from '../../../common-adapters'
import {styleSheetCreate} from '../../../styles'
import Header from '../header'

type DisplayItem = {currencyCode: string, symbol: string, type: 'display choice'}
type OtherItem = {code: string, disabledExplanation: string, issuer: string, type: 'other choice'}

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
            selected={false}
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
            selected={false}
          />
        )
      default:
        throw new Error(`ChooseAsset: impossible item type encountered: ${item.type}`)
    }
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
          <SectionList sections={sections} renderItem={this._renderItem} renderSectionHeader={() => null} />
        </Box2>
      </Box2>
    )
  }
}

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
    <Text type="Body">
      Lumens (XLM) displayed as{' '}
      <Text type="BodyExtrabold">
        {props.currencyCode} ({props.symbol})
      </Text>
    </Text>
  </Box2>
)

type OtherChoiceProps = {
  code: string,
  disabledExplanation: string,
  issuer: string,
  onClick: () => void,
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
      <Text type="Body">
        <Text type="BodyExtrabold">{props.code}</Text>/{props.issuer}
      </Text>
      {!!props.disabledExplanation && <Text type="BodySmall">{props.disabledExplanation}</Text>}
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  choiceContainer: {
    alignItems: 'center',
    height: 40,
  },
  container: {
    width: 360,
  },
  listContainer: {
    maxHeight: 525 - 48,
  },
})

export default ChooseAsset
