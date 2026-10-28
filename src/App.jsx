import React, { useEffect } from 'react'
import AllRoutes from './All-Routes/AllRoutes'
import { installColumnResize } from './utils/tableColumnResize'
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
// import 'react-toastify/dist/ReactToastify.css';
import "./App.css"
import './styles/animations.css'
import { ToastContainer } from 'react-toastify';

const App = () => {
  // Excel-style drag-to-resize columns on every table in the app.
  useEffect(() => installColumnResize(), [])

  return (
    <div>
     <ToastContainer />
      <AllRoutes />
    </div>
  )
}
export default App
