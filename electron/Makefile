NODE_BIN=./node_modules/.bin
ELECTRON=$(NODE_BIN)/electron
BROWSERIFY=$(NODE_BIN)/browserify
TSC=$(NODE_BIN)/tsc
LESS=$(NODE_BIN)/lessc
ASAR=$(NODE_BIN)/asar

all: dep build

run: build
	@$(ELECTRON) build

dep:
	@npm install

build: clean
	@mkdir build
	@mkdir build/browser
	@mkdir build/renderer

	@cp -r config build/
	@cp -r ./node_modules/normalize.css/normalize.css build/
	@cp -r main.js build/
	@cp -r index.html build/
	@cp -r resource build/
	@cp -r package.json build/

	# Renderer scripts
	$(TSC) -p ./renderer
	$(BROWSERIFY) ./build/renderer/app.js -o build/renderer.js --ignore ipc --debug

	# Browser scripts
	$(TSC) -p ./browser

	# Styles
	$(LESS) ./style/main.less > build/built.css

clean: clean-asar
	@rm -rf ./build

asar: clean-asar build
	@mkdir asar
	@cp -r ./build asar/
	@cd asar; npm install --production; cd ..
	$(ASAR) pack asar build/app.asar

clean-asar:
	@rm -rf ./asar

package: clean asar
	@mv build/app.asar build/Keybase.app/Contents/Resources/
	@echo "done"

.PHONY: run dep build clean
