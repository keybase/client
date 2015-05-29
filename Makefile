lint:
	golint ./... | grep -v mocks_test\.go || echo "Lint-free!"

.PHONY: lint
