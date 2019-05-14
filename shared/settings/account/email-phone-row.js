// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'

// props exported for stories
export type Props = {|
  address: string,
  unverified: boolean,
  subtitle: string,
|}

const EmailPhoneRow = (props: Props) => {
  return (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.container}>
      <Kb.Box2 alignItems="flex-start" direction="vertical">
        <Kb.Text type="BodySemibold">{props.address}</Kb.Text>
        {(!!props.subtitle || props.unverified) && (
          <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
            {props.unverified && <Kb.Meta backgroundColor={Styles.globalColors.red} title="UNVERIFIED" />}
            {!!props.subtitle && <Kb.Text type="BodySmall">{props.subtitle}</Kb.Text>}
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: {
    height: Styles.isMobile ? 48 : 40,
  },
})

// props exported for stories
export type OwnProps = {|
  contactKey: string,
|}

// TODO mocked for now
const mapStateToProps = (state, ownProps) => ({})
const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  address: '',
  subtitle: '',
  unverified: false,
})

const ConnectedEmailPhoneRow = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedEmailPhoneRow'
)(EmailPhoneRow)

export default ConnectedEmailPhoneRow
