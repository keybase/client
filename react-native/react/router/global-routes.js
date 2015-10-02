'use strict'
/*
 * Components which could show up at any point in a route. Meta navigator will see if .canParseRoute(currentPath)
 * returns true, which indicates it can be injected
 * @flow
 */

import Immutable from 'immutable'
import Search from '../search'

export default Immutable.List.of(Search)
