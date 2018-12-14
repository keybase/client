lint:
	( \
		which golint >/dev/null 2>&1 \
		|| ( \
			echo "Missing golint" \
			&& exit 1 \
		) \
	) \
	&& ( \
		golint ./... \
		| grep -v ^vendor \
		| grep -v mocks_test\.go \
		| grep -v mock_codec\.go \
		| grep -v "protocol\/" \
		| grep -v "error should be the last type" \
		| grep -v "_test\.go.*context\.Context should be the first parameter of a function" \
		| grep -v "use underscores in Go names" \
		&& exit 1 \
		|| echo "Lint-free!" \
	)

.PHONY: lint
