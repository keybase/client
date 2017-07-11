build: bundle

release: clean bundle
	mkdir build/
	git archive HEAD . | tar x -C build/
	cp js/bundle.js build/js/bundle.js
	cp ../LICENSE build/LICENSE
	jq 'del(.key)' build/manifest.json > build/manifest.firefox.json
	jq 'del(.key,.applications)' build/manifest.json > build/manifest.chrome.json
	@echo "Packaging Chrome..."
	cp build/manifest.chrome.json build/manifest.json
	cd build && zip -q -r ../keybase-firefox-$(shell jq -r ".version" manifest.json).zip .
	@echo "Packaging Firefox..."
	cp build/manifest.firefox.json build/manifest.json
	cd build && zip -q -r ../keybase-chrome-$(shell jq -r ".version" manifest.json).zip .

clean:
	rm -rf build/

bundle: ./js/bundle.js

js/bundle.js: package.json webpack.config.js js/bundle.entry.js
	yarn build
