#!/bin/sh -x

iced mkdata.iced  < legacy_uid.txt > ../data.go && go fmt ../data.go 
