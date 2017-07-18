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

typedef NS_OPTIONS (NSUInteger, KBInstallOptions) {
  KBInstallOptionNone = 0,
  KBInstallOptionService = 1 << 1,
  KBInstallOptionHelper = 1 << 2,
  KBInstallOptionFuse = 1 << 3,
  KBInstallOptionKBFS = 1 << 4,
  KBInstallOptionUpdater = 1 << 5,
  KBInstallOptionMountDir = 1 << 6,
  KBInstallOptionEtcPaths = 1 << 10,
  KBInstallOptionAppBundle = 1 << 11,
  KBInstallOptionKBNM = 1 << 12,
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
@property (readonly) KBInstallOptions installOptions;
@property (readonly) NSTimeInterval installTimeout;
@property (readonly) NSString *appPath;
@property (readonly) NSString *sourcePath;

- (instancetype)initWithRunMode:(KBRunMode)runMode;

+ (instancetype)envConfigWithHomeDir:(NSString *)homeDir mountDir:(NSString *)mountDir runMode:(KBRunMode)runMode;
+ (instancetype)envConfigWithRunMode:(KBRunMode)runMode;
+ (instancetype)envConfigWithRunModeString:(NSString *)runModeString installOptions:(KBInstallOptions)installOptions installTimeout:(NSTimeInterval)installTimeout appPath:(NSString *)appPath sourcePath:(NSString *)sourcePath;
+ (instancetype)envConfigFromUserDefaults:(NSUserDefaults *)userDefaults;

- (void)saveToUserDefaults:(NSUserDefaults *)userDefaults;

- (BOOL)isHomeDirSet;

- (NSString *)sockFile;

- (NSString *)logFile:(NSString *)label;

- (NSString *)dataPath:(NSString *)filename options:(KBPathOptions)options;
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

