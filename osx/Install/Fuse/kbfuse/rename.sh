ext=(c h m plist pbxproj)
for i in "${ext[@]}"
do
echo "Ext: $i"
find . -name "*.$i" -type f -exec sed -i '' s/osxfuse/kbfuse/ {} +
find . -name "*.$i" -type f -exec sed -i '' s/OSXFUSE/KBFUSE/ {} +
done

find . -name '*osxfuse*' -exec sh -c 'mv {} $(echo {} | sed -e 's/osxfuse/kbfuse/g')' \;
