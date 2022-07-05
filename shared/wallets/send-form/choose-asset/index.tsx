import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import Header from '../header'

export type DisplayItem = {
  currencyCode: string
  selected: boolean
  symbol: string
  type: 'display choice'
}

export type Props = {
  displayChoices: Array<DisplayItem>
  onBack: () => void
  onChoose: (item: DisplayItem) => void
  onRefresh: () => void
  isRequest: boolean
  selected: string
}

class ChooseAsset extends React.Component<Props> {
  componentDidMount() {
    this.props.onRefresh()
  }

  _renderItem = ({
    item,
  }: {
    item: DisplayItem & {
      key: string
    }
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
    }
  }

  _renderSectionHeader = ({section}) => {
    switch (section.key) {
      case 'display choices':
        return (
          <Kb.Box2 direction="vertical" style={styles.sectionHeaderContainer} fullWidth={true}>
            <Kb.Text key="choices" type="BodySmallSemibold">
              Lumens (XLM)
            </Kb.Text>
          </Kb.Box2>
        )
      case 'divider':
        return <Kb.Divider key={section.key} />
    }
    return null
  }

  render() {
    const displayChoicesData = this.props.displayChoices.map(dc => ({...dc, key: dc.currencyCode}))
    if (!displayChoicesData.find(c => c.currencyCode === 'XLM')) {
      displayChoicesData.unshift({
        currencyCode: 'XLM',
        key: 'XLM',
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
    ]
    return (
      <Kb.MaybePopup onClose={this.props.onBack}>
        <Kb.Box2 direction="vertical" style={styles.container}>
          <Header
            isRequest={this.props.isRequest}
            onBack={this.props.onBack}
            whiteBackground={true}
            showCancelInsteadOfBackOnMobile={false}
          />
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
            <Kb.SectionList
              sections={sections}
              renderItem={this._renderItem}
              renderSectionHeader={this._renderSectionHeader}
              contentContainerStyle={styles.sectionList}
              stickySectionHeadersEnabled={false}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.MaybePopup>
    )
  }
}

type DisplayChoiceProps = {
  currencyCode: string
  onClick: () => void
  selected: boolean
  symbol: string
}

const DisplayChoice = (props: DisplayChoiceProps) => (
  <Kb.ClickableBox
    hoverColor={Styles.globalColors.blueLighter2}
    onClick={props.onClick}
    style={styles.displayChoice}
  >
    <Kb.Box2 direction="horizontal" style={styles.choiceContainer} fullWidth={true}>
      <Kb.BoxGrow style={styles.growContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} centerChildren={true}>
          <Kb.Text
            type="Body"
            style={Styles.collapseStyles([styles.choice, props.selected ? styles.blue : undefined])}
          >
            {props.symbol === 'XLM' ? 'Purely strictly ' : 'Lumens displayed as '}
            <Kb.Text type="BodyExtrabold" style={props.selected ? styles.blue : undefined}>
              {props.symbol === 'XLM' ? 'Lumens' : props.currencyCode} ({props.symbol})
            </Kb.Text>
          </Kb.Text>
        </Kb.Box2>
      </Kb.BoxGrow>
      {props.selected && (
        <Kb.Icon type="iconfont-check" color={Styles.globalColors.blue} boxStyle={styles.checkIcon} />
      )}
    </Kb.Box2>
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      blue: {
        color: Styles.globalColors.blueDark,
      },
      checkIcon: Styles.platformStyles({
        isElectron: {display: 'inline-flex'},
        isMobile: {marginLeft: Styles.globalMargins.tiny},
      }),
      choice: {width: '100%'},
      choiceContainer: Styles.platformStyles({
        common: {
          // needed to get on top of absolutely positioned background color
          alignItems: 'center',
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
          position: 'relative',
          width: '100%',
        },
        isElectron: {
          height: 40,
        },
        isMobile: {
          height: 56,
        },
      }),
      container: Styles.platformStyles({
        isElectron: {
          height: 560,
          width: 400,
        },
        isMobile: {
          flex: 1,
          width: '100%',
        },
      }),
      displayChoice: {
        width: '100%',
      },
      growContainer: {
        alignItems: 'center',
        height: '100%',
      },
      listContainer: Styles.platformStyles({
        isElectron: {
          maxHeight: 560 - 48,
        },
        isMobile: {
          flex: 1,
        },
      }),
      sectionHeaderContainer: Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          backgroundColor: Styles.globalColors.blueLighter3,
          justifyContent: 'center',
          paddingBottom: Styles.globalMargins.tiny,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.tiny,
        },
        isElectron: {
          // must be uniform height with current SectionList implementation
          // so first doesn't peek out from under the second
          height: 32,
        },
      }),
      sectionList: {
        flexGrow: 0,
      },
      spacer: {
        flex: 1,
      },
    } as const)
)

export default ChooseAsset
