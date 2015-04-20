//
//  KBPriviledgedTask.h
//  Keybase
//
//  Created by Gabriel on 4/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

// Unused; Using priviledged helper tool
@interface KBPriviledgedTask : NSObject

- (BOOL)execute:(NSString *)cmd args:(NSArray *)args error:(NSError **)error;

@end
