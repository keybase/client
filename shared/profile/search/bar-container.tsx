import * as Container from '../../util/container'
import {StylesCrossPlatform} from '../../styles'
import {appendPeopleBuilder} from '../../actions/typed-routes'
import Bar from './bar'

type OwnProps = {
  style?: StylesCrossPlatform
  whiteText?: boolean
}

export default Container.namedConnect(
  () => ({}),
  dispatch => ({
    onSearch: () => {
      dispatch(appendPeopleBuilder())
    },
  }),
  (_, dispatchProps, ownProps: OwnProps) => ({...ownProps, onSearch: dispatchProps.onSearch}),
  'PeopleTabSearch'
)(Bar)
