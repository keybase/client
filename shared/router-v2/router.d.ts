import * as React from 'react'

export type Props = {persistRoute: (path: string) => void; isDarkMode?: boolean}
declare class Router extends React.Component<Props> {}
export default Router
