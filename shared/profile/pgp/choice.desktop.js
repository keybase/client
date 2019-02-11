// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'

type OwnProps = {||}

const Choice = props => (
  <Kb.StandardScreen onCancel={props.onCancel} style={{maxWidth: 512}}>
    <Kb.Text style={styleTitle} type="Header">
      Add a PGP key
    </Kb.Text>
    <Kb.ChoiceList
      options={[
        {
          description: 'Keybase will generate a new PGP key and add it to your profile.',
          icon: 'icon-pgp-key-new-48',
          onClick: () => props.onOptionClick('provideInfo'),
          title: 'Get a new PGP key',
        },
        {
          description: 'Import an existing PGP key to your Keybase profile.',
          icon: 'icon-pgp-key-import-48',
          onClick: () => props.onOptionClick('import'),
          title: 'I have one already',
        },
      ]}
    />
    <Kb.Button style={styleCancelButton} type="Secondary" onClick={props.onCancel} label={'Cancel'} />
  </Kb.StandardScreen>
)

const styleTitle = {
  marginBottom: Styles.globalMargins.medium,
}

const styleCancelButton = {
  marginTop: Styles.globalMargins.medium,
}

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onOptionClick: (type: 'import' | 'provideInfo') =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [type]})),
})

export default namedConnect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'Choice'
)(Choice)
