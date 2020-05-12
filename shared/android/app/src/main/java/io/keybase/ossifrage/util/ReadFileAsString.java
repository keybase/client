package io.keybase.ossifrage.util;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;

public class ReadFileAsString {

    private ReadFileAsString() {
        // No instance
    }

    public static String read(String path) {
        String ret = "";

        try (FileInputStream inputStream = new FileInputStream(new File(path));
             InputStreamReader inputStreamReader = new InputStreamReader(inputStream);
             BufferedReader bufferedReader = new BufferedReader(inputStreamReader)) {
            String receiveString;
            StringBuilder stringBuilder = new StringBuilder();

            while ((receiveString = bufferedReader.readLine()) != null) {
                stringBuilder.append(receiveString);
            }

            ret = stringBuilder.toString();
        } catch (IOException e) {
            // ignore
        }

        return ret;
    }
}