import React from "react"
import ReactDOM from "react-dom/client"
import { StreamlitProvider } from "streamlit-component-lib"
import Component from "./index.jsx"

const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(
  <React.StrictMode>
    <StreamlitProvider>
      <Component />
    </StreamlitProvider>
  </React.StrictMode>
)
