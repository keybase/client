
fmt:
	for i in daemon client libkb libcmdline; do \
		(cd $$i && go fmt) ; \
	done
