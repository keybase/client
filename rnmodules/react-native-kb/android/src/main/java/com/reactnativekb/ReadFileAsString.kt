package com.reactnativekb

import java.io.BufferedReader
import java.io.File
import java.io.FileInputStream
import java.io.FileNotFoundException
import java.io.IOException
import java.io.InputStreamReader

object ReadFileAsString {
    fun read(path: String): String {
        var ret = ""

        try {
            val inputStream = FileInputStream(File(path))

            inputStream.use {
                val inputStreamReader = InputStreamReader(it)
                val bufferedReader = BufferedReader(inputStreamReader)
                val stringBuilder = StringBuilder()

                var receiveString: String?

                while (bufferedReader.readLine().also { receiveString = it } != null) {
                    stringBuilder.append(receiveString)
                }

                ret = stringBuilder.toString()
            }
        } catch (e: FileNotFoundException) {
            // ignore
        } catch (e: IOException) {
            // ignore
        }

        return ret
    }
}
