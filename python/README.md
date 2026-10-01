# Surpryze Python CLI

No Node/npm required. Use with the Claude/Cursor skill in `skills/surpryze/SKILL.md`.

```bash
cd python
pip install -e .
# or: python -m surpryze ...
```

```bash
surpryze scan /path/to/react-app -o assumption-graph.json
surpryze gap /path/to/ui-tests assumption-graph.json -o gap-analysis.json
```
