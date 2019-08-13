import * as React from 'react'

export type Props = {
  persistRoute: (path: Array<any>) => void
  isDarkMode?: boolean
}
declare class Router extends React.Component<Props> {}
export default Router
