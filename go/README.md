## Keybase Services

### Building

```bash
cd keybase
go get -u
go build -a
```

### Testing

To test install Boot2Docker and run:

```bash
docker build -t kbweb .
make test
```
