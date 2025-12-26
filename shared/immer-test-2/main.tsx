import * as React from 'react'
import {createRoot} from 'react-dom/client'
import TestApp from './index'

const root = createRoot(document.getElementById('root')!)
root.render(<TestApp />)

