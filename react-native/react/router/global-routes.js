'use strict'
/*
 * Components which could show up at any point in a route. Meta navigator will call parseRoute. If that
 * returns null it means it can't handle the route
 *
 * @flow
 */

import Immutable from 'immutable'
import Search from '../search'

export default Immutable.List.of(Search)
