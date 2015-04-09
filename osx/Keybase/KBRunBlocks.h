//
//  KBRunBlocks.h
//  Keybase
//
//  Created by Gabriel on 4/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBKeybase/KBKeybase.h>

typedef void (^KBRunBlock)(id obj, KBCompletionHandler completion);
typedef void (^KBRunCompletionBlock)(NSArray *errors, NSArray *objs);

@interface KBRunBlocks : NSObject

@property NSArray *objects;
@property (copy) KBRunBlock runBlock;
@property (copy) KBRunCompletionBlock completionBlock;

- (void)run;

- (void)run:(dispatch_queue_t)queue;

@end
