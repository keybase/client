
# How To Run This

Generate the data.go file as follows:

```
cat sigid-fixes  | awk ' { print $2 } ' | sort | iced3 mkdata.iced > ../data.go
cd ..
go fmt .
```
