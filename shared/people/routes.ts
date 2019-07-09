import PeopleRoot from './container'

export const newRoutes = {
  peopleRoot: {getScreen: (): typeof PeopleRoot => require('./container').default, upgraded: true},
}

export const newModalRoutes = {}
