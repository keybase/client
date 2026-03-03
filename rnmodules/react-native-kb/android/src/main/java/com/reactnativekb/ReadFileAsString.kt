package com.reactnativekb

import java.io.File
import java.io.FileNotFoundException
import java.io.IOException

object ReadFileAsString {
    fun read(path: String): String {
        return try {
            File(path).readText()
        } catch (e: FileNotFoundException) {
            ""
        } catch (e: IOException) {
            ""
        }
    }
}
