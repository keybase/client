//
//  KBEnvConfig.h
//  Keybase
//
//  Created by Gabriel on 5/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBKit/KBPath.h>

typedef NS_ENUM (NSInteger, KBRunMode) {
  KBRunModeProd,
  KBRunModeStaging,
  KBRunModeDevel,
};

@interface KBEnvConfig : NSObject

@property (nonatomic, readonly) NSString *homeDir;
@property (readonly, getter=isDebugEnabled) BOOL debugEnabled;
@property (readonly) NSString *mountDir;
@property (readonly) NSString *title;
@property (readonly) NSString *info;
@property (readonly) NSImage *image;
@property (readonly) KBRunMode runMode;
@property (readonly, getter=isInstallDisabled) BOOL installDisabled;

- (instancetype)initWithRunMode:(KBRunMode)runMode;

+ (instancetype)envConfigWithHomeDir:(NSString *)homeDir mountDir:(NSString *)mountDir runMode:(KBRunMode)runMode;
+ (instancetype)envConfigWithRunMode:(KBRunMode)runMode;
+ (instancetype)envConfigFromUserDefaults:(NSUserDefaults *)userDefaults;

- (void)saveToUserDefaults:(NSUserDefaults *)userDefaults;

- (BOOL)isHomeDirSet;

- (NSString *)sockFile;

- (NSString *)logFile:(NSString *)label;

- (NSString *)appPath:(NSString *)filename options:(KBPathOptions)options;
- (NSString *)runtimePath:(NSString *)filename options:(KBPathOptions)options;
- (NSString *)cachePath:(NSString *)filename options:(KBPathOptions)options;

- (NSString *)appName;
- (NSString *)serviceBinName;
- (NSString *)serviceBinPathWithPathOptions:(KBPathOptions)pathOptions servicePath:(NSString *)servicePath;
- (NSString *)kbfsBinPathWithPathOptions:(KBPathOptions)pathOptions servicePath:(NSString *)servicePath;

- (BOOL)validate:(NSError **)error;

- (NSString *)launchdServiceLabel;
- (NSString *)launchdKBFSLabel;
- (NSString *)launchdUpdaterLabel;

- (BOOL)isInApplications:(NSString *)path;
- (BOOL)isInUserApplications:(NSString *)path;

@end

NSString *NSStringFromKBRunMode(KBRunMode runMode, BOOL isValue);

