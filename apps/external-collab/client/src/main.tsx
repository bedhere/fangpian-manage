import React from 'react'
import ReactDOM from 'react-dom/client'
import DashboardRoot from './DashboardRoot'
import './fangpian-theme.css'
import { installExternalCollabBridge } from './fangpian-bridge'

installExternalCollabBridge()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><DashboardRoot /></React.StrictMode>,
)
