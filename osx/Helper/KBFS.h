//
//  KBFS.h
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBHelperDefines.h"

@interface KBFS : NSObject

- (instancetype)initWithPath:(NSString *)path;

- (NSString *)sourceVersion;
- (NSString *)destinationVersion;

- (void)install:(KBOnCompletion)completion;

- (void)uninstall:(KBOnCompletion)completion;

/*!
 Status: ok, needs_install or needs_update.
 */
- (void)status:(KBOnCompletion)completion;

/*!
 Installs, updates or loads KBFS.
 
 If not present, installs and loads.
 If present and older version than unloads, updates and loads.
 If present and same version, does nothing.
 
 Always loads the kext (no op is already loaded).
 */
- (void)load:(KBOnCompletion)completion;

- (void)unload:(KBOnCompletion)completion;

@end
