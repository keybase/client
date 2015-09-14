protocol
========

A local protocol for different parts of the Keybase system

* Description of Avro IDL [here](http://avro.apache.org/docs/1.7.5/idl.html)
* running `make` should work
* input files are in `avdl/`
* output files dropped into `json/`


making a new protocol
=====================
* Add filename to Makefile under build-stamp
* Add the protocol to the master list in service/main.go RegisterProtocols
