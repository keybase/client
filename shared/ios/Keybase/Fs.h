//
//  Fs.h
//  Keybase
//
//  Created by Michael Maxim on 9/5/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#ifndef Fs_h
#define Fs_h

#import <Foundation/Foundation.h>

@interface FsHelper : NSObject
- (NSDictionary*) setupFs:(BOOL)skipLogFile setupSharedHome:(BOOL)setupSharedHome;
@end

#endif /* Fs_h */
