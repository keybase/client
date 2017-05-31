build: bundle

release: clean bundle
	mkdir build/
	git archive HEAD . | tar x -C build/
	cp js/bundle.js build/js/bundle.js
	cp ../LICENSE build/LICENSE
	sed -i "" '/"key"\:/d' build/manifest.json  # Strip hardcoded dev key
	cd build && zip -r ../keybase-extension-$(shell grep '"version":' manifest.json | cut -d '"' -f4).zip .

clean:
	rm -rf build/

bundle: ./js/bundle.js

js/bundle.js: package.json webpack.config.js js/bundle.entry.js
	yarn build
