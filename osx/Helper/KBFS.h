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

- (void)installWithSource:(NSString *)bundle destination:(NSString *)destination kextID:(NSString *)kextID completion:(KBOnCompletion)completion;

/*!
 Installs or updates.

 If not present, installs and loads.
 If present and older version then unload, update and re-load.
*/
- (void)installOrUpdateWithSource:(NSString *)bundle destination:(NSString *)destination kextID:(NSString *)kextID completion:(KBOnCompletion)completion;

/*!
 Uninstall.
 */
- (void)uninstallWithDestination:(NSString *)destination kextID:(NSString *)kextID completion:(KBOnCompletion)completion;

/*!
 Always loads the kext (no op if it is already loaded).
 */
- (void)loadKextID:(NSString *)kextID path:(NSString *)path completion:(KBOnCompletion)completion;

- (void)unloadWithKextLabel:(NSString *)kextID completion:(KBOnCompletion)completion;

@end
