//
//  KBEnvConfig.h
//  Keybase
//
//  Created by Gabriel on 5/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBPath.h"

typedef NS_ENUM (NSInteger, KBEnvType) {
  KBEnvTypeCustom = 0,
  KBEnvTypeProd,
  KBEnvTypeDevel,
  KBEnvTypeBrew,
};

@interface KBEnvConfig : NSObject

@property (nonatomic, readonly) NSString *homeDir;
@property (readonly) NSString *host;
@property (readonly, getter=isDebugEnabled) BOOL debugEnabled;
@property (readonly) NSString *mountDir;
@property (nonatomic, readonly) NSString *sockFile;
@property (readonly, getter=isLaunchdEnabled) BOOL launchdEnabled;
@property (readonly) NSString *launchdLabelService;
@property (readonly) NSString *launchdLabelKBFS;
@property (readonly) NSString *title;
@property (readonly) NSString *info;
@property (readonly) NSImage *image;
@property (readonly, getter=isInstallEnabled) BOOL installEnabled; // Whether to attempt install
@property (readonly) KBEnvType envType;

- (instancetype)initWithEnvType:(KBEnvType)envType;

+ (instancetype)customEnvWithHomeDir:(NSString *)homeDir sockFile:(NSString *)sockFile mountDir:(NSString *)mountDir;

+ (instancetype)envType:(KBEnvType)envType;

+ (instancetype)loadFromUserDefaults:(NSUserDefaults *)userDefaults;
- (void)saveToUserDefaults:(NSUserDefaults *)userDefaults;

- (BOOL)isHomeDirSet;
- (BOOL)isSockFileSet;

- (NSString *)logFile:(NSString *)label;

- (NSString *)appPath:(NSString *)filename options:(KBPathOptions)options;
- (NSString *)cachePath:(NSString *)filename options:(KBPathOptions)options;

- (NSBundle *)bundle;

- (BOOL)validate:(NSError **)error;

@end

