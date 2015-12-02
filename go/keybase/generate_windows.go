// +build windows

package main

//go:generate cmd /c echo // Auto generated > ../libkb/hash_windows.go
//go:generate cmd /c echo package libkb >> ../libkb/hash_windows.go
//go:generate cmd /c echo func (g *GlobalContext) Hash() string { >> ../libkb/hash_windows.go
//go:generate cmd /c echo|set /p dummyName=return  >> ../libkb/hash_windows.go
//go:generate cmd /c git log -n 1 --pretty=format:"%H" >> ../libkb/hash_windows.go
//go:generate cmd /c echo } >> ../libkb/hash_windows.go
//go:generate go build ../winresource
//go:generate ./winresource.exe

func noOp() {

}
