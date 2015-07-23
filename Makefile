lint:
	golint ./... | grep -v mocks_test\.go | grep -v "error should be the last type" || echo "Lint-free!"

.PHONY: lint
