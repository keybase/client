
# How To Run This

Generate the data.go file as follows:

```
grep -E '^h' sigids-1.0.16 > nacl-1.0.16.txt
cat sigid-fixes | awk ' { print "g", $2 } | sort >> nacl-1.0.16.txt
iced3 mkdata.iced < nacl-1.0.16.txt > ../data.go
cd ..
go fmt .
```
