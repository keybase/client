engine:
	@go build -buildmode=c-shared -o ext/engine.so ext/hooks/hooks.go

test:	engine
	@bundle install --quiet
	@bundle exec rake test

clean:
	@rm -rf ext/engine.so
	@rm -rf ext/engine.h
