import * as Container from '../../util/container'
import {StylesCrossPlatform} from '../../styles'
import {createSearchSuggestions} from '../../actions/search-gen'
import Bar from './bar'

type OwnProps = {
  style?: StylesCrossPlatform
  whiteText?: boolean
}

const mapDispatchToProps = dispatch => ({
  onSearch: () => {
    dispatch(createSearchSuggestions({searchKey: 'profileSearch'}))
  },
})

const mergeProps = (_, dispatchProps, ownProps: OwnProps) => ({...ownProps, onSearch: dispatchProps.onSearch})

export default Container.namedConnect(() => ({}), mapDispatchToProps, mergeProps, 'PeopleTabSearch')(Bar)
