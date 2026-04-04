import streamlit as st
from streamlit_node_editor import st_node_editor

st.set_page_config(page_title="Node Editor Demo", layout="wide")
st.title("🔗 streamlit-node-editor demo")
st.caption("Right-click the canvas to add nodes. Drag from an output port to an input port to connect. Click a wire to delete it. Delete key removes the selected node.")

NODE_DEFS = {
    "Load Checkpoint": {
        "category": "Loaders", "headerColor": "#fb923c",
        "inputs": [],
        "outputs": [{"name": "MODEL", "type": "MODEL"}, {"name": "CLIP", "type": "CLIP"}, {"name": "VAE", "type": "VAE"}],
        "params": [{"key": "ckpt_name", "label": "Checkpoint", "type": "select",
                    "options": ["v1-5-pruned.ckpt", "sd_xl_base.safetensors"]}],
    },
    "CLIP Text Encode": {
        "category": "Conditioning", "headerColor": "#facc15",
        "inputs":  [{"name": "clip", "type": "CLIP"}],
        "outputs": [{"name": "CONDITIONING", "type": "LATENT"}],
        "params":  [{"key": "text", "label": "Prompt", "type": "textarea"}],
    },
    "KSampler": {
        "category": "Sampling", "headerColor": "#818cf8",
        "inputs": [{"name": "model", "type": "MODEL"}, {"name": "positive", "type": "LATENT"},
                   {"name": "negative", "type": "LATENT"}, {"name": "latent_image", "type": "LATENT"}],
        "outputs": [{"name": "LATENT", "type": "LATENT"}],
        "params": [{"key": "steps", "label": "Steps", "type": "int", "default": 20},
                   {"key": "cfg",   "label": "CFG",   "type": "float", "default": 7.0},
                   {"key": "sampler", "label": "Sampler", "type": "select",
                    "options": ["euler", "euler_a", "dpm++2m", "ddim"]}],
    },
    "Empty Latent Image": {
        "category": "Latent", "headerColor": "#c084fc",
        "inputs": [], "outputs": [{"name": "LATENT", "type": "LATENT"}],
        "params": [{"key": "width", "label": "Width", "type": "int", "default": 512},
                   {"key": "height", "label": "Height", "type": "int", "default": 512}],
    },
    "VAE Decode": {
        "category": "Latent", "headerColor": "#f87171",
        "inputs":  [{"name": "samples", "type": "LATENT"}, {"name": "vae", "type": "VAE"}],
        "outputs": [{"name": "IMAGE", "type": "IMAGE"}],
        "params":  [],
    },
    "Save Image": {
        "category": "Output", "headerColor": "#4ade80",
        "inputs":  [{"name": "images", "type": "IMAGE"}],
        "outputs": [],
        "params":  [{"key": "filename_prefix", "label": "Filename", "type": "string", "default": "output"}],
    },
}

graph = st_node_editor(NODE_DEFS, height=650, key="demo_graph")

if graph:
    with st.expander(f"Graph JSON — {len(graph['nodes'])} nodes, {len(graph['connections'])} connections"):
        st.json(graph)
