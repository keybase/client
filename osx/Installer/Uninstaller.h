//
//  Uninstaller.h
//  Keybase
//
//  Created by Gabriel on 1/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBKit/KBKit.h>
#import "Settings.h"

@interface Uninstaller : NSObject

+ (void)uninstallWithSettings:(Settings *)settings completion:(KBCompletion)completion;

@end
