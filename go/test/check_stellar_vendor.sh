#!/bin/bash

if [ $(find vendor/github.com/stellar -type f -print0 | sort -z | xargs -0 shasum | shasum | colrm 41) == "f3a7d9906dab5c481669b5b4f852bf447388bd3d" ] 
then
	echo "stellar vendor check passed"
else
	echo "stellar vendor check failed"
	exit 1
fi
