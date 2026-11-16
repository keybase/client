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
  KBInstallOptionRedirector = 1 << 7,
  KBInstallOptionCLI = 1 << 10,
  KBInstallOptionAppBundle = 1 << 11,
};

@interface KBEnvConfig : NSObject

@property (readonly) NSString *mountDir;
@property (readonly) KBRunMode runMode;
@property (readonly) KBInstallOptions installOptions;
@property (readonly) NSTimeInterval installTimeout;
@property (readonly) NSString *appPath;
@property (readonly) NSString *sourcePath;

- (instancetype)initWithRunMode:(KBRunMode)runMode;

+ (instancetype)envConfigWithRunMode:(KBRunMode)runMode;
+ (instancetype)envConfigWithRunModeString:(NSString *)runModeString installOptions:(KBInstallOptions)installOptions installTimeout:(NSTimeInterval)installTimeout appPath:(NSString *)appPath sourcePath:(NSString *)sourcePath;

- (NSString *)dataPath:(NSString *)filename options:(KBPathOptions)options;

- (NSString *)appName;
- (NSString *)serviceBinName;
- (NSString *)serviceBinPathWithPathOptions:(KBPathOptions)pathOptions servicePath:(NSString *)servicePath;
- (NSString *)redirectorBinPathWithPathOptions:(KBPathOptions)pathOptions servicePath:(NSString *)servicePath;
- (NSString *)gitRemoteHelperName;
- (NSString *)redirectorBinName;
- (NSString *)redirectorMount;
- (NSString *)volumesRedirectorMount;
- (BOOL)redirectorDisabled;

- (NSString *)launchdServiceLabel;
- (NSString *)launchdKBFSLabel;
- (NSString *)launchdUpdaterLabel;

- (BOOL)isInApplications:(NSString *)path;

@end

NSString *NSStringFromKBRunMode(KBRunMode runMode, BOOL isValue);
