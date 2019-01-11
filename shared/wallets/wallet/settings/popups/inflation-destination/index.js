// @flow
import React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {WalletPopup} from '../../../../common'
import openUrl from '../../../../../util/open-url'

export type Props = {|
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
|}

class InflationDestinationPopup extends React.Component<Props, State> {
  constructor(props) {
    super(props)

    const reco = props.options.find(o => o.recommended)

    this.state = {
      address: reco ? reco.address : '',
    }
  }

  _submit = () => {
    this.props.onSubmit(this.state.address)
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
        bottomButtons={Styles.isMobile ? buttons.reverse() : buttons}
      >
        <Kb.Box2 centerChildren={true} direction="vertical" fullWidth={true} fullHeight={true} gap="small">
          <Kb.Icon
            type={
              Styles.isMobile
                ? 'icon-stellar-coins-stacked-inflation-64'
                : 'icon-stellar-coins-stacked-inflation-48'
            }
          />
          <Kb.Text type="Header"> Inflation Destination </Kb.Text>
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
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
            {this.props.options.map(o => (
              <Kb.Box2 key={o.name} direction="horizontal" fullWidth={true} gap="xtiny">
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
                  />
                )}
              </Kb.Box2>
            ))}
          </Kb.Box2>
        </Kb.Box2>
      </WalletPopup>
    )
  }
}

const styles = Styles.styleSheetCreate({
  header: {borderBottomWidth: 0},
})

export default InflationDestinationPopup
