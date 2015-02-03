
fmt:
	for i in daemon client libkb libcmdline libkb/engine; do \
		(cd $$i && go fmt) ; \
	done
