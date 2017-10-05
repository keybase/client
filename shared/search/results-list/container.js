// @flow
import {connect, type TypedState} from '../../util/container'
import SearchResultsList from '.'

// TODO use entities
const mapStateToProps = ({entities}: TypedState) => {
  return {}
}

// TODO
const mapDispatchToProps = (dispatch: Dispatch) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(SearchResultsList)
