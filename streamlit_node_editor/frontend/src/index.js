import React from "react"
import ReactDOM from "react-dom/client"
import { Streamlit } from "streamlit-component-lib"
import Component from "./index.jsx"

Streamlit.setFrameHeight()

const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
)
