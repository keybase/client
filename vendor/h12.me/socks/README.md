SOCKS
=====

[![GoDoc](https://godoc.org/h12.me/socks?status.svg)](https://godoc.org/h12.me/socks)

SOCKS is a SOCKS4, SOCKS4A and SOCKS5 proxy package for Go.

## Quick Start
### Get the package

    go get -u "h12.me/socks"

### Import the package

    import "h12.me/socks"

### Create a SOCKS proxy dialing function

    dialSocksProxy := socks.DialSocksProxy(socks.SOCKS5, "127.0.0.1:1080")
    tr := &http.Transport{Dial: dialSocksProxy}
    httpClient := &http.Client{Transport: tr}

## Alternatives
http://godoc.org/golang.org/x/net/proxy
