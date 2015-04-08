//
//  KBStream.h
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBReader.h"
#import "KBWriter.h"
#import "KBRPC.h"

typedef NSString *(^KBFileOutput)(NSString *path);

@interface KBStream : NSObject

@property id<KBReader> reader;
@property id<KBWriter> writer;
@property (nonatomic) int label;
@property NSError *error;

+ (instancetype)streamWithReader:(id<KBReader>)reader writer:(id<KBWriter>)writer;

- (void)close;

#pragma mark -

- (void)registerWithClient:(KBRPClient *)client sessionId:(NSInteger)sessionId;

+ (void)checkFiles:(NSArray */*of KBFile*/)files index:(NSInteger)index output:(KBFileOutput)output streams:(NSMutableArray *)streams skipCheck:(BOOL)skipCheck view:(NSView *)view completion:(KBCompletionBlock)completion;

@end
