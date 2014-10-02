
package libkb

func ErrToOk(err error) string {
	if err == nil {
		return "ok"
	} else {
		return "ERROR"
	}
}
