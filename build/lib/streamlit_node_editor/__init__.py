import os
import streamlit.components.v1 as components

_RELEASE = True

if _RELEASE:
    _component_func = components.declare_component(
        "streamlit_node_editor",
        path=os.path.join(os.path.dirname(__file__), "frontend/build"),
    )
else:
    _component_func = components.declare_component(
        "streamlit_node_editor",
        url="http://localhost:3001",
    )


def st_node_editor(node_defs, initial_nodes=None, initial_connections=None,
                   height=700, key=None):
    """
    Render a ComfyUI / Unreal Blueprints-style node graph editor.

    Users can add nodes from a palette, connect typed ports by dragging,
    edit inline parameters, and delete nodes or wires interactively.

    Parameters
    ----------
    node_defs : dict[str, dict]
        Registry of available node types. Each entry::

            "Node Name": {
                "category": str,          # groups nodes in the palette
                "headerColor": str,       # hex color for the node header bar
                "inputs": [               # list of input port definitions
                    {"name": str, "type": str},   # type must be a key in port_types
                ],
                "outputs": [              # list of output port definitions
                    {"name": str, "type": str},
                ],
                "params": [               # inline editable parameters
                    {
                        "key":      str,
                        "label":    str,
                        "type":     str,          # "int" | "float" | "string" | "select" | "textarea"
                        "default":  any,          # optional default value
                        "options":  list[str],    # required for type="select"
                    }
                ],
            }

    initial_nodes : list[dict], optional
        Pre-placed nodes on load. Each dict::

            {"id": str, "type": str, "x": float, "y": float,
             "params": {key: value}}

    initial_connections : list[dict], optional
        Pre-existing wires. Each dict::

            {"id": str, "fromNode": str, "fromPort": int,
                        "toNode":   str, "toPort":   int}

    height : int
        Canvas height in pixels. Default 700.
    key : str, optional
        Streamlit widget key.

    Returns
    -------
    dict | None
        Current graph state::

            {
                "nodes": [
                    {"id": str, "type": str, "x": float, "y": float,
                     "params": {key: value}},
                    ...
                ],
                "connections": [
                    {"id": str, "fromNode": str, "fromPort": int,
                               "toNode":   str, "toPort":   int},
                    ...
                ],
            }

        Returns None before any interaction.

    Example
    -------
    >>> from streamlit_node_editor import st_node_editor
    >>>
    >>> NODE_DEFS = {
    ...     "Load Data": {
    ...         "category": "Sources",
    ...         "headerColor": "#4ade80",
    ...         "inputs": [],
    ...         "outputs": [{"name": "dataframe", "type": "DATAFRAME"}],
    ...         "params": [{"key": "path", "label": "CSV path", "type": "string"}],
    ...     },
    ...     "Filter Rows": {
    ...         "category": "Transform",
    ...         "headerColor": "#38bdf8",
    ...         "inputs":  [{"name": "dataframe", "type": "DATAFRAME"}],
    ...         "outputs": [{"name": "dataframe", "type": "DATAFRAME"}],
    ...         "params": [{"key": "query", "label": "Query", "type": "string"}],
    ...     },
    ... }
    >>>
    >>> graph = st_node_editor(NODE_DEFS, height=600, key="pipeline")
    >>> if graph:
    ...     st.json(graph)
    """
    return _component_func(
        node_defs=node_defs,
        initial_nodes=initial_nodes or [],
        initial_connections=initial_connections or [],
        height=height,
        key=key,
        default=None,
    )
