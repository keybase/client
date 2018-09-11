/*
 * Copyright 2015 The Go Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

package org.golang.mobile

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Plugin
import org.gradle.api.Task
import org.gradle.api.file.FileCollection;
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.compile.JavaCompile

import org.golang.mobile.OutputFileTask
import org.golang.mobile.AARPublishArtifact

/*
 * GobindPlugin configures the default project that builds .AAR file
 * from a go package, using gomobile bind command.
 * For gomobile bind command, see https://golang.org/x/mobile/cmd/gomobile
 *
 * If the project has the android or android library plugin loaded, GobindPlugin
 * hooks into the android build lifecycle in two steps. First, the Java classes are
 * generated and registered with the android plugin. Then, when the databinding
 * classes and the R classes are generated and compiled, the GobindPlugin generates
 * the JNI libraries. By splitting the binding in two steps, the Android databinding
 * machinery can resolve Go classes, and Go code can access the resulting databinding
 * classes as well as the R resource classes.
 */
class GobindPlugin implements Plugin<Project> {
	void apply(Project project) {
		project.extensions.create('gobind', GobindExtension)
		// If the android or android library plugin is loaded, integrate
		// directly with the android build cycle
		if (project.plugins.hasPlugin("android") ||
				project.plugins.hasPlugin("com.android.application")) {
			project.android.applicationVariants.all { variant ->
				handleVariant(project, variant)
			}
			return
		}
		if (project.plugins.hasPlugin("android-library") ||
				project.plugins.hasPlugin("com.android.library")) {
			project.android.libraryVariants.all { variant ->
				handleVariant(project, variant)
			}
			return
		}

		// Library mode: generate and declare the .aar file for parent
		// projects to include.
		project.configurations.create("default")

		Task gomobileTask = project.tasks.create("gobind", GomobileTask)
		gomobileTask.outputFile = project.file(project.name+".aar")
		project.artifacts.add("default", new AARPublishArtifact(
			'mylib',
			null,
			gomobileTask))

		Task cleanTask = project.tasks.create("clean", {
			project.delete(project.name+".aar")
		})
	}

	private static void handleVariant(Project project, def variant) {
		File outputDir = project.file("$project.buildDir/generated/source/gobind/$variant.dirName")
		// First, generate the Java classes with the gobind tool.
		Task bindTask = project.tasks.create("gobind${variant.name.capitalize()}", GobindTask)
		bindTask.outputDir = outputDir
		bindTask.javaCompile = variant.javaCompile
		bindTask.bootClasspath = variant.javaCompile.options.bootClasspath
		// TODO: Detect when updating the Java classes is redundant.
		bindTask.outputs.upToDateWhen { false }
		variant.registerJavaGeneratingTask(bindTask, outputDir)
		// Then, generate the JNI libraries with the gomobile tool.
		Task libTask = project.tasks.create("gomobile${variant.name.capitalize()}", GomobileTask)
		libTask.bootClasspath = variant.javaCompile.options.bootClasspath
		libTask.javaCompile = variant.javaCompile
		// Dump the JNI libraries in the known project jniLibs directory.
		// TODO: Use a directory below build for the libraries instead. Adding a jni directory to the jniLibs
		// property of android.sourceSets only works, but only if the directory changes every build.
		libTask.libsDir = project.file("src/main/jniLibs")
		// TODO: Detect when building the existing JNI libraries is redundant.
		libTask.outputs.upToDateWhen { false }
		libTask.dependsOn(bindTask)
		variant.javaCompile.finalizedBy(libTask)
	}
}

class BindTask extends DefaultTask {
	String bootClasspath

	def run(String cmd, String cmdPath, List<String> cmdArgs) {
		def pkg = project.gobind.pkg.trim()
		def gopath = (project.gobind.GOPATH ?: System.getenv("GOPATH"))?.trim()
		if (!pkg || !gopath) {
			throw new GradleException('gobind.pkg and gobind.GOPATH must be set')
		}

		def paths = (gopath.split(File.pathSeparator).collect{ "$it/bin" } +
			System.getenv("PATH").split(File.pathSeparator)).flatten()
		// Default installation path of go distribution.
		if (isWindows()) {
			paths = paths + "c:\\Go\\bin"
		} else {
			paths = paths + "/usr/local/go/bin"
		}

		def exe = (cmdPath ?: findExecutable(cmd, paths))?.trim()
		def gobin = (project.gobind.GO ?: findExecutable("go", paths))?.trim()
		def gomobileFlags = project.gobind.GOMOBILEFLAGS?.trim()

		if (!exe || !gobin) {
			throw new GradleException('failed to find ${cmd}/go tools. Set gobind.GOBIND, gobind.GOMOBILE, and gobind.GO')
		}

		paths = [findDir(exe), findDir(gobin), paths].flatten()

		def androidHome = ""
		try {
			Properties properties = new Properties()
			properties.load(project.rootProject.file('local.properties').newDataInputStream())
			androidHome = properties.getProperty('sdk.dir')
		} catch (all) {
			logger.info("failed to load local.properties.")
		}
		if (!androidHome?.trim()) {
			// fallback to ANDROID_HOME
			androidHome = System.getenv("ANDROID_HOME")
		}

		project.exec {
			executable(exe)

			if (bootClasspath)
				cmdArgs.addAll(["-bootclasspath", bootClasspath])
			if (gomobileFlags) {
				cmdArgs.addAll(gomobileFlags.split(" "))
			}
			cmdArgs.addAll(pkg.split(" "))

			args(cmdArgs)
			if (!androidHome?.trim()) {
				throw new GradleException('Neither sdk.dir or ANDROID_HOME is set')
			}
			environment("GOPATH", gopath)
			environment("GOOS", "android")
			environment("PATH", paths.join(File.pathSeparator))
			environment("ANDROID_HOME", androidHome)
		}
	}

	def isWindows() {
		return System.getProperty("os.name").startsWith("Windows")
	}

	def findExecutable(String name, ArrayList<String> paths) {
		if (isWindows() && !name.endsWith(".exe")) {
			name = name + ".exe"
		}
		for (p in paths) {
		   def f = new File(p + File.separator + name)
		   if (f.exists()) {
			   return p + File.separator + name
		   }
		}
		throw new GradleException('binary ' + name + ' is not found in $PATH (' + paths + ')')
	}

	def findDir(String binpath) {
		if (!binpath) {
			return ""
		}

		def f = new File(binpath)
		return f.getParentFile().getAbsolutePath();
	}
}

class GobindTask extends BindTask {
	@OutputDirectory
	File outputDir

	JavaCompile javaCompile

	@TaskAction
	def gobind() {
		run("gobind", project.gobind.GOBIND, ["-lang", "java", "-classpath", javaCompile.classpath.join(File.pathSeparator), "-outdir", outputDir.getAbsolutePath()])
	}
}

class GomobileTask extends BindTask implements OutputFileTask {
	@Optional
	@OutputFile
	File outputFile

	@Optional
	@OutputDirectory
	File libsDir

	JavaCompile javaCompile

	@TaskAction
	def gomobile() {
		if (outputFile == null) {
			outputFile = File.createTempFile("gobind-", ".aar")
		}
		def cmd = ["bind", "-i"]
		// Add the generated R and databinding classes to the classpath.
		if (javaCompile) {
			def classpath = project.files(javaCompile.classpath, javaCompile.destinationDir)
			cmd << "-classpath"
			cmd << classpath.join(File.pathSeparator)
		}
		cmd << "-o"
		cmd << outputFile.getAbsolutePath()
		cmd << "-target"
		def goarch = project.gobind.GOARCH?.trim()
		if (goarch) {
			cmd = cmd+goarch.split(" ").collect{ 'android/'+it }.join(",")
		} else {
			cmd << "android"
		}
		run("gomobile", project.gobind.GOMOBILE, cmd)
		// If libsDir is set, unpack (only) the JNI libraries to it.
		if (libsDir != null) {
			project.delete project.fileTree(dir: libsDir, include: '*/libgojni.so')
			def zipFile = new java.util.zip.ZipFile(outputFile)
			zipFile.entries().findAll { !it.directory && it.name.startsWith("jni/") }.each {
				def libFile = new File(libsDir, it.name.substring(4))
				libFile.parentFile.mkdirs()
				zipFile.getInputStream(it).withStream {
					libFile.append(it)
				}
			}
			outputFile.delete()
		}
	}
}

class GobindExtension {
	// Package to bind. Separate multiple packages with spaces. (required)
	def String pkg = ""

	// GOPATH: necessary for gomobile tool. (required)
	def String GOPATH = System.getenv("GOPATH")

	// GOARCH: (List of) GOARCH to include.
	def String GOARCH = ""

	// GO: path to go tool. (can omit if 'go' is in the paths visible by Android Studio)
	def String GO = ""

	// GOMOBILE: path to gomobile binary. (can omit if 'gomobile' is under GOPATH)
	def String GOMOBILE = ""

	// GOBIND: path to gobind binary. (can omit if 'gobind' is under GOPATH)
	def String GOBIND = ""

	// GOMOBILEFLAGS: extra flags to be passed to gomobile command. (optional)
	def String GOMOBILEFLAGS = ""
}
