//
//  KBFSInstaller.h
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBFSInstaller : NSObject

- (instancetype)initWithPath:(NSString *)path;

- (NSString *)sourceVersion;
- (NSString *)destinationVersion;

- (BOOL)install:(NSError **)error;

@end
