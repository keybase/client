
package libkbgo

type Global struct {
	Env *Env
	LoginState *LoginState
}

var G Global = Global { nil, nil }
