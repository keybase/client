//
//  KBEnvConfig.h
//  Keybase
//
//  Created by Gabriel on 5/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM (NSInteger, KBRunMode) {
  KBRunModeProd,
  KBRunModeStaging,
  KBRunModeDevel,
};

typedef NS_OPTIONS (NSUInteger, KBInstallOptions) {
  KBInstallOptionNone = 0,
  KBInstallOptionHelper = 1 << 2,
  KBInstallOptionFuse = 1 << 3,
  KBInstallOptionMountDir = 1 << 6,
  KBInstallOptionRedirector = 1 << 7,
  KBInstallOptionCLI = 1 << 10,
  KBInstallOptionAppBundle = 1 << 11,
};

@interface KBEnvConfig : NSObject

@property (readonly) NSString *mountDir;
@property (readonly) KBInstallOptions installOptions;
@property (readonly) NSString *appPath;
@property (readonly) NSString *sourcePath;

+ (instancetype)envConfigWithRunModeString:(NSString *)runModeString installOptions:(KBInstallOptions)installOptions appPath:(NSString *)appPath sourcePath:(NSString *)sourcePath;

- (NSString *)dataPath:(NSString *)filename;

- (NSString *)appName;
- (NSString *)serviceBinName;
- (NSString *)serviceBinPath:(NSString *)servicePath;
- (NSString *)redirectorBinPath:(NSString *)servicePath;
- (NSString *)gitRemoteHelperName;
- (NSString *)redirectorBinName;
- (NSString *)redirectorMount;
- (NSString *)volumesRedirectorMount;
- (BOOL)redirectorDisabled;

@end
