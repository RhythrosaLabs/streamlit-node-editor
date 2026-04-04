# streamlit-node-editor

A ComfyUI / Unreal Blueprints-style node graph editor for Streamlit. Define typed node types in Python, let users build graphs by dragging ports and connecting nodes, and get the full graph state back as structured JSON.

![Node editor screenshot](https://raw.githubusercontent.com/RhythrosaLabs/streamlit-node-editor/main/docs/screenshot.png)

## Features

- **Typed ports** with color-coded data types — only compatible types can connect
- **Drag-to-wire** — click an output port, drag, drop on a compatible input to create a connection
- **Type validation** — incompatible connections are silently rejected
- **Inline node parameters** — select dropdowns, number inputs, text inputs, and textareas inside each node
- **Node palette** — searchable list of all available node types; right-click canvas or use toolbar button
- **Click wire to delete** — no menu needed
- **Delete / Backspace** removes the selected node and all its connections
- **Collapse nodes** to save canvas space
- **Pan + scroll-to-zoom** with proper SVG coordinate transform
- **Animated dot-grid background**
- Zero runtime dependencies beyond Streamlit (no React Flow, no external graph lib)

## Installation

```bash
pip install streamlit-node-editor
```

## Quickstart — data pipeline builder

```python
import streamlit as st
from streamlit_node_editor import st_node_editor

NODE_DEFS = {
    "CSV Source": {
        "category": "Sources",
        "headerColor": "#4ade80",
        "inputs": [],
        "outputs": [{"name": "dataframe", "type": "DATAFRAME"}],
        "params": [
            {"key": "path", "label": "File path", "type": "string", "default": "data.csv"},
            {"key": "sep",  "label": "Separator", "type": "string", "default": ","},
        ],
    },
    "Filter Rows": {
        "category": "Transform",
        "headerColor": "#38bdf8",
        "inputs":  [{"name": "df_in",  "type": "DATAFRAME"}],
        "outputs": [{"name": "df_out", "type": "DATAFRAME"}],
        "params": [
            {"key": "query", "label": "Query expr", "type": "string",
             "default": "value > 0"},
        ],
    },
    "Group By": {
        "category": "Transform",
        "headerColor": "#818cf8",
        "inputs":  [{"name": "df_in",  "type": "DATAFRAME"}],
        "outputs": [{"name": "df_out", "type": "DATAFRAME"}],
        "params": [
            {"key": "column", "label": "Column",   "type": "string"},
            {"key": "agg",    "label": "Aggregate","type": "select",
             "options": ["sum", "mean", "count", "min", "max"]},
        ],
    },
    "Bar Chart": {
        "category": "Outputs",
        "headerColor": "#fb923c",
        "inputs":  [{"name": "dataframe", "type": "DATAFRAME"}],
        "outputs": [],
        "params": [
            {"key": "x", "label": "X column", "type": "string"},
            {"key": "y", "label": "Y column", "type": "string"},
        ],
    },
}

graph = st_node_editor(NODE_DEFS, height=600, key="pipeline")

if graph:
    st.subheader("Graph state")
    st.json(graph)

    # Execute the pipeline
    if st.button("Run pipeline"):
        import pandas as pd
        # Walk graph["connections"] in topological order and execute each node
        # based on graph["nodes"][i]["type"] and graph["nodes"][i]["params"]
        st.info("Pipeline execution logic goes here")
```

## API

```python
st_node_editor(node_defs, initial_nodes=None, initial_connections=None, height=700, key=None)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `node_defs` | `dict[str, dict]` | required | Node type registry |
| `initial_nodes` | `list[dict]` | `[]` | Pre-placed nodes |
| `initial_connections` | `list[dict]` | `[]` | Pre-existing wires |
| `height` | `int` | `700` | Canvas height in pixels |
| `key` | `str` | `None` | Streamlit widget key |

### Node definition schema

```python
"Node Type Name": {
    "category":    str,         # palette grouping
    "headerColor": str,         # hex color for the node's title bar
    "inputs": [
        {"name": str, "type": str}   # type key must match a registered port type
    ],
    "outputs": [
        {"name": str, "type": str}
    ],
    "params": [
        {
            "key":     str,
            "label":   str,
            "type":    str,          # "int" | "float" | "string" | "select" | "textarea"
            "default": any,          # optional
            "options": list[str],    # required when type == "select"
        }
    ],
}
```

### Built-in port types

| Type | Color | Typical use |
|------|-------|-------------|
| `IMAGE` | green | Pixel data |
| `LATENT` | purple | Latent tensors |
| `MODEL` | orange | Neural network weights |
| `CLIP` | yellow | Text encoders |
| `VAE` | red | Variational autoencoders |
| `INT` | blue | Integer values |
| `FLOAT` | indigo | Float values |
| `STRING` | stone | Text |
| `MASK` | teal | Binary masks |
| `ANY` | gray | Accepts any type |

Define your own types freely in `node_defs` — any unrecognized type string uses the `ANY` gray color.

### Return value

```python
{
    "nodes": [
        {
            "id":     str,
            "type":   str,
            "x":      float,
            "y":      float,
            "params": {key: value, ...}
        },
        ...
    ],
    "connections": [
        {
            "id":       str,
            "fromNode": str,   # node id
            "fromPort": int,   # output port index
            "toNode":   str,   # node id
            "toPort":   int,   # input port index
        },
        ...
    ]
}
```

## Development

```bash
git clone https://github.com/RhythrosaLabs/streamlit-node-editor
cd streamlit-node-editor

cd streamlit_node_editor/frontend
npm install
npm start   # dev server on :3004

# separate terminal
cd ../..
pip install -e .
# Set _RELEASE = False in streamlit_node_editor/__init__.py
streamlit run example.py
```

## License

MIT
