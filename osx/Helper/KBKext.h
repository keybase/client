//
//  KBFuse.h
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBHelperDefines.h"


@interface KBKext : NSObject

/*!
 Install.
 */
+ (void)installWithSource:(NSString *)source destination:(NSString *)destination kextID:(NSString *)kextID kextPath:(NSString *)kextPath completion:(KBOnCompletion)completion;

/*!
 Uninstall.
 */
+ (void)uninstallWithDestination:(NSString *)destination kextID:(NSString *)kextID completion:(KBOnCompletion)completion;

/*!
 Copy to destination.
 */
+ (void)copyWithSource:(NSString *)source destination:(NSString *)destination removeExisting:(BOOL)removeExisting completion:(KBOnCompletion)completion;

/*!
 Always loads the kext (no-op if it is already loaded).
 */
+ (void)loadKextID:(NSString *)kextID path:(NSString *)path completion:(KBOnCompletion)completion;

+ (void)unloadKextID:(NSString *)kextID completion:(KBOnCompletion)completion;


+ (BOOL)updateLoaderFileAttributes:(NSString *)destination error:(NSError **)error;

@end
