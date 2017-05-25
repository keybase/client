release: clean
	mkdir build/
	git archive HEAD . | tar x -C build/
	sed -i "" '/"key"\:/d' build/manifest.json  # Strip hardcoded dev key
	cd build && zip -r ../keybase-extension-$(shell grep '"version":' manifest.json | cut -d '"' -f4).zip .

clean:
	rm -rf build/
