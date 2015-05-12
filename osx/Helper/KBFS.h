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

- (NSString *)bundleVersion;
- (NSString *)installedVersion;
- (NSString *)runningVersion;


- (void)install:(KBOnCompletion)completion;

/*!
 Installs or updates.

 If not present, installs and loads.
 If present and older version then unload, update and re-load.
*/
- (void)installOrUpdate:(KBOnCompletion)completion;

- (void)uninstall:(KBOnCompletion)completion;

/*!
 Always loads the kext (no op if it is already loaded).
 */
- (void)load:(KBOnCompletion)completion;

- (void)unload:(KBOnCompletion)completion;

@end
