// @flow

import {namedConnect} from '../../../util/container'
import ThreadSearch from '.'

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({})

export default namedConnect<_, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...s, ...d}),
  'ThreadSearch'
)(ThreadSearch)
