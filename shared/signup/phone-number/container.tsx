import * as React from 'react'
import * as Container from '../../util/container'
import * as SignupGen from '../../actions/signup-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {InfoIcon} from '../common'
import EnterPhoneNumber from '.'

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({})

const ConnectedEnterPhoneNumber = Container.connect(mapStateToProps, mapDispatchToProps)(EnterPhoneNumber)

// @ts-ignore fix this
ConnectedEnterPhoneNumber.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

export default EnterPhoneNumber
