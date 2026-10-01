.PHONY: install demo-scan demo-gap

install:
	cd python && pip install -e .

demo-scan:
	cd python && python3 -m surpryze scan ../examples/react-password-ui -o ../examples/react-password-ui/assumption-graph.json

demo-gap:
	cd python && python3 -m surpryze gap ../examples/password-reset-suite ../examples/react-password-ui/assumption-graph.json -o ../examples/react-password-ui/gap-analysis.json
