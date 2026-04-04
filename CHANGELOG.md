# Changelog

## 0.2.0

- Wire up Streamlit bidirectional communication (setComponentReady, RENDER_EVENT, setComponentValue)
- Accept `initial_nodes` and `initial_connections` from Python args
- Return `{nodes, connections}` graph state to Python on every change
- Fix: connections initialized with null placeholder causing wire render crash
- Remove unused `Port` component (inline circles used in `GraphNode`)
- Add `Framework :: Streamlit` classifier to setup.py
- Add project_urls (Bug Tracker, Changelog) to setup.py
- Fix .gitignore: stop ignoring frontend build dir (required for PyPI)

## 0.1.1

- Set author to Dan Sheils

## 0.1.0

- Initial release

