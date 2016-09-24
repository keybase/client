lint:
	golint ./... | grep -v ^vendor | grep -v mocks_test\.go | grep -v mock_codec\.go | grep -v "protocol\/" | grep -v "error should be the last type" || echo "Lint-free!"

.PHONY: lint
