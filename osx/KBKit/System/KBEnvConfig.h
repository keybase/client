//
//  KBEnvConfig.h
//  Keybase
//
//  Created by Gabriel on 5/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBPath.h"

typedef NS_ENUM (NSInteger, KBRunMode) {
  KBRunModeCustom = 0,
  KBRunModeProd,
  KBRunModeStaging,
  KBRunModeDevel,
};

@interface KBEnvConfig : NSObject

@property (nonatomic, readonly) NSString *homeDir;
@property (readonly, getter=isDebugEnabled) BOOL debugEnabled;
@property (readonly) NSString *mountDir;
@property (nonatomic, readonly) NSString *sockFile;
@property (readonly) NSString *title;
@property (readonly) NSString *info;
@property (readonly) NSImage *image;
@property (readonly) KBRunMode runMode;

- (instancetype)initWithRunMode:(KBRunMode)runMode;

+ (instancetype)envConfigWithHomeDir:(NSString *)homeDir sockFile:(NSString *)sockFile mountDir:(NSString *)mountDir;
+ (instancetype)envConfigWithRunMode:(KBRunMode)runMode;
+ (instancetype)envConfigFromUserDefaults:(NSUserDefaults *)userDefaults;

- (void)saveToUserDefaults:(NSUserDefaults *)userDefaults;

- (BOOL)isHomeDirSet;
- (BOOL)isSockFileSet;

- (NSString *)logFile:(NSString *)label;

- (NSString *)appPath:(NSString *)filename options:(KBPathOptions)options;
- (NSString *)cachePath:(NSString *)filename options:(KBPathOptions)options;

- (NSBundle *)bundle;

- (BOOL)validate:(NSError **)error;

- (NSString *)launchdServiceLabel;
- (NSString *)launchdKBFSLabel;

@end

NSString *NSStringFromKBRunMode(KBRunMode runMode, BOOL isValue);

