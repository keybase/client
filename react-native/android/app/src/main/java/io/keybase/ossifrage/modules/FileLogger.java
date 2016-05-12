package io.keybase.ossifrage.modules;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import org.slf4j.LoggerFactory;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.android.LogcatAppender;
import ch.qos.logback.classic.encoder.PatternLayoutEncoder;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.FileAppender;
import io.keybase.ossifrage.MainActivity;

public class FileLogger extends ReactContextBaseJavaModule {
    public static boolean configured = false;
    private static final String NAME = "FileLogger";
    private org.slf4j.Logger log;

    public FileLogger(final ReactApplicationContext reactContext, String logFilePath) {
        super(reactContext);
        configureLogbackDirectly(logFilePath);
        log = LoggerFactory.getLogger(MainActivity.class);
    }

    synchronized public static void configureLogbackDirectly(String filePath) {
        if (FileLogger.configured) {
            return;
        }
        FileLogger.configured = true;

        // reset the default context (which may already have been initialized)
        // since we want to reconfigure it
        LoggerContext lc = (LoggerContext) LoggerFactory.getILoggerFactory();
        lc.reset();

        // setup FileAppender
        PatternLayoutEncoder encoder1 = new PatternLayoutEncoder();
        encoder1.setContext(lc);
        encoder1.setPattern("%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n");
        encoder1.start();

        FileAppender<ILoggingEvent> fileAppender = new FileAppender<ILoggingEvent>();
        fileAppender.setContext(lc);
        fileAppender.setFile(filePath);
        fileAppender.setEncoder(encoder1);
        fileAppender.start();

        // setup LogcatAppender
        PatternLayoutEncoder encoder2 = new PatternLayoutEncoder();
        encoder2.setContext(lc);
        encoder2.setPattern("[%thread] %msg%n");
        encoder2.start();

        LogcatAppender logcatAppender = new LogcatAppender();
        logcatAppender.setContext(lc);
        logcatAppender.setEncoder(encoder2);
        logcatAppender.start();

        // add the newly created appenders to the root logger;
        // qualify Logger to disambiguate from org.slf4j.Logger
        ch.qos.logback.classic.Logger root = (ch.qos.logback.classic.Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        root.addAppender(fileAppender);
        root.addAppender(logcatAppender);
    }


    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void info(String stringToLog) {
        log.info(stringToLog);
    }

    @ReactMethod
    public void warn(String stringToLog) {
        log.warn(stringToLog);
    }

    @ReactMethod
    public void error(String stringToLog) {
        log.error(stringToLog);
    }
}
