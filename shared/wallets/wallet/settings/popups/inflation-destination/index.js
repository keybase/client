// @flow
import React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {WalletPopup} from '../../../../common'
import openUrl from '../../../../../util/open-url'

export type Props = {|
  inflationDestination: string,
  options: Array<{
    name: string,
    recommended: boolean,
    address: string,
    link: string,
  }>,
  onSubmit: string => void,
  onClose: () => void,
|}

type State = {|
  address: string,
  otherAddress: string,
|}

class InflationDestinationPopup extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)

    let address = props.inflationDestination
    if (!address) {
      const reco = props.options.find(o => o.recommended)
      address = reco?.address || ''
    }

    this.state = {address, otherAddress: ''}
  }

  _submit = () => {
    this.props.onSubmit(this.state.address)
  }

  componentDidUpdate(prevProps: Props) {
    // got updated
    if (this.props.inflationDestination !== prevProps.inflationDestination) {
      this.props.onClose()
    }
  }

  render() {
    const props = this.props
    const buttons = [
      <Kb.Button
        fullWidth={Styles.isMobile}
        key="Cancel"
        label="Cancel"
        onClick={props.onClose}
        type="Secondary"
      />,
      <Kb.WaitingButton
        fullWidth={Styles.isMobile}
        waitingKey={''}
        key="Save"
        label="Save"
        onClick={this._submit}
        disabled={!this.state.address.length}
        type="Wallet"
      />,
    ]

    // Only show the lumenaut thing if its an option
    let lumenautLink
    this.props.options.some(o => {
      if (o.name === 'Lumenaut') {
        if (o.link.length) {
          lumenautLink = () => openUrl(o.link)
          return true
        }
      }
      return false
    })

    return (
      <WalletPopup
        onExit={props.onClose}
        backButtonType="cancel"
        headerStyle={styles.header}
        containerStyle={styles.container}
        bottomButtons={Styles.isMobile ? buttons.reverse() : buttons}
      >
        <Kb.Box2
          centerChildren={true}
          direction="vertical"
          fullWidth={true}
          fullHeight={!Styles.isMobile}
          gap="small"
        >
          <Kb.Icon
            type={
              Styles.isMobile
                ? 'icon-stellar-coins-stacked-inflation-64'
                : 'icon-stellar-coins-stacked-inflation-48'
            }
          />
          <Kb.Text type="Header"> Inflation destination</Kb.Text>
          <Kb.Text type="Body">
            Every year, the total Lumens grows by 1% due to inflation, and you can cast a vote for who gets
            it.
          </Kb.Text>
          {!!lumenautLink && (
            <Kb.Text type="Body">
              One service,{' '}
              <Kb.Text type="BodyPrimaryLink" onClick={lumenautLink}>
                Lumenaut
              </Kb.Text>
              , takes your votes then gives the inflation they collect on your behalf back to you. So it's a
              common choice.
            </Kb.Text>
          )}
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioContainer}>
            {this.props.options.map(o => (
              <Kb.Box2 key={o.name} direction="horizontal" fullWidth={true} gap="xtiny" style={styles.row}>
                <Kb.RadioButton
                  onSelect={() => this.setState({address: o.address})}
                  selected={this.state.address === o.address}
                  label={o.name}
                />
                {o.recommended && <Kb.Text type="BodySemibold">(Recommended)</Kb.Text>}
                {!!o.link && (
                  <Kb.Icon
                    color={Styles.globalColors.blue}
                    type="iconfont-open-browser"
                    onClick={() => openUrl(o.link)}
                    fontSize={Styles.isMobile ? 16 : 12}
                  />
                )}
              </Kb.Box2>
            ))}
            <Kb.Box2
              key="other"
              direction="vertical"
              fullWidth={true}
              gap="xtiny"
              style={styles.otherContainer}
            >
              <Kb.RadioButton
                onSelect={() => this.setState({address: this.state.otherAddress})}
                selected={this.state.address === this.state.otherAddress}
                label="Other"
              />
              <Kb.Box2 direction="vertical" gap="xtiny" style={styles.otherInput}>
                <Kb.Text type="BodyTinySemibold" style={styles.specify}>
                  Specify:
                </Kb.Text>
                <Kb.PlainInput
                  placeholder="Enter a Stellar address..."
                  multiline={true}
                  value={this.state.otherAddress}
                  onChangeText={otherAddress => this.setState({address: otherAddress, otherAddress})}
                />
              </Kb.Box2>
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
      </WalletPopup>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      flexGrow: 1,
    },
    isElectron: {
      borderRadius: 'inherit',
      paddingBottom: Styles.globalMargins.medium,
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.medium,
      textAlign: 'center',
    },
    isMobile: {
      padding: Styles.globalMargins.small,
    },
  }),
  header: {borderBottomWidth: 0},
  otherContainer: {alignItems: 'flex-start'},
  otherInput: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    borderColor: Styles.globalColors.black_20,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    marginLeft: Styles.globalMargins.medium,
    marginRight: Styles.globalMargins.medium,
    minHeight: 88,
    padding: Styles.globalMargins.tiny,
  },
  radioContainer: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  row: {
    alignItems: 'center',
    flexShrink: 0,
  },
  specify: {
    color: Styles.globalColors.blue,
  },
})

export default InflationDestinationPopup
