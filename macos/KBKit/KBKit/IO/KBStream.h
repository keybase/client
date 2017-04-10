//
//  KBStream.h
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBReader.h"
#import "KBWriter.h"
#import "KBRPC.h"
#import "KBDefines.h"

typedef NSString *(^KBFileOutput)(NSString *path);

@interface KBStream : NSObject

@property (readonly) id<KBReader> reader;
@property (readonly) id<KBWriter> writer;
@property (readonly) u_int32_t label;

+ (instancetype)streamWithReader:(id<KBReader>)reader writer:(id<KBWriter>)writer label:(int)label;

- (void)close;

#pragma mark -

- (void)registerWithClient:(KBRPClient *)client sessionId:(NSNumber *)sessionId;

+ (void)checkFiles:(NSArray */*of KBFile*/)files index:(NSInteger)index output:(KBFileOutput)output streams:(NSMutableArray *)streams skipCheck:(BOOL)skipCheck view:(NSView *)view completion:(KBCompletion)completion;

@end
