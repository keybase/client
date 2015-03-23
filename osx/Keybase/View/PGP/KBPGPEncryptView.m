//
//  KBPGPEncryptView.m
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncryptView.h"

#import "KBUserProfileView.h"
#import "KBReadBuffer.h"

@interface KBPGPEncryptView ()
@property KBTextView *textView;
@property KBUserProfileView *trackView;

@property KBReadBuffer *readBuffer;
@property NSMutableData *writeBuffer;
@end

@implementation KBPGPEncryptView

- (void)viewInit {
  [super viewInit];

  _textView = [[KBTextView alloc] init];
  [self addSubview:_textView];

  YOView *footerView = [YOHBox box:@{@"spacing": @"10", @"minSize": @"130,0", @"horizontalAlignment": @"right"}];
  KBButton *cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  cancelButton.targetBlock = ^{ [[self window] close]; };
  [footerView addSubview:cancelButton];
  KBButton *button = [KBButton buttonWithText:@"Encrypt" style:KBButtonStylePrimary];
  button.targetBlock = ^{ [self encrypt]; };
  [footerView addSubview:button];
  [self addSubview:footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_textView topView:nil bottomView:footerView insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20 maxSize:CGSizeMake(800, 400)]];
}

- (void)registerTrackView:(NSInteger)sessionId {
  if (!_trackView) {
    _trackView = [[KBUserProfileView alloc] init];
    _trackView.popup = YES;
  }
  [_trackView registerClient:self.client sessionId:sessionId sender:self];
}

- (void)encrypt {
  //NSString *outputPath = [NSTemporaryDirectory() stringByAppendingPathComponent:NSStringWithFormat(@"%@", NSUUID.UUID.UUIDString)];
  NSString *text = _textView.text;

  _readBuffer = [KBReadBuffer bufferWithData:[text dataUsingEncoding:NSUTF8StringEncoding]];
  _writeBuffer = [NSMutableData dataWithCapacity:_readBuffer.data.length * 2];

  //NSFileHandle *fileHandleOut = [NSFileHandle fileHandleForWritingAtPath:output];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = -1;

  KBRStream *sink = [[KBRStream alloc] init];
  //sink.fd = fileHandleOut.fileDescriptor;
  sink.fd = -2;

  KBRPgpEncryptOptions *options = [[KBRPgpEncryptOptions alloc] init];
  options.noSelf = YES;
  options.localOnly = YES;
  options.recipients = @[@"t_alice"];
  options.binaryOut = NO;

  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];

  [self registerTrackView:request.sessionId];

  GHWeakSelf gself = self;
  [self.client registerMethod:@"keybase.1.streamUi.read" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
      KBRReadRequestParams *requestParams = [[KBRReadRequestParams alloc] initWithParams:params];
      //NSAssert(requestParams.s.fd == -1, @"Invalid file descriptor");
      NSData *data = [gself.readBuffer read:requestParams.sz];
      dispatch_async(dispatch_get_main_queue(), ^{
        if (!data) {
          completion(KBMakeError(1504, @"EOF"), nil);
        } else {
          completion(nil, data);
        }
      });
    });
  }];

  [self.client registerMethod:@"keybase.1.streamUi.write" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
      KBRWriteRequestParams *requestParams = [[KBRWriteRequestParams alloc] initWithParams:params];
      //NSAssert(requestParams.s.fd == fileHandleOut.fileDescriptor, @"Invalid file descriptor");
      GHDebug(@"Write (%@)", @(requestParams.buf.length));
      //[fileHandleOut writeData:requestParams.buf];
      [gself.writeBuffer appendData:requestParams.buf];
      dispatch_async(dispatch_get_main_queue(), ^{
        completion(nil, @(requestParams.buf.length));
      });
    });
  }];

  [self.client registerMethod:@"keybase.1.streamUi.close" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
      /*
      KBRCloseRequestParams *requestParams = [[KBRCloseRequestParams alloc] initWithParams:params];
      NSAssert(requestParams.s.fd == fileHandleOut.fileDescriptor, @"Invalid file descriptor");
      GHDebug(@"Close file");
      [fileHandleOut synchronizeFile];
      [fileHandleOut closeFile];
       */
      dispatch_async(dispatch_get_main_queue(), ^{
        completion(nil, nil);
      });
    });
  }];

  [self.navigation setProgressEnabled:YES];
  [request pgpEncryptWithSessionID:request.sessionId source:source sink:sink opts:options completion:^(NSError *error) {
    [gself.navigation setProgressEnabled:NO];
    if ([self.navigation setError:error sender:self]) return;

    [[gself.trackView window] close];

    //NSString *encrypted = [NSString stringWithContentsOfFile:output encoding:NSUTF8StringEncoding error:&error];
    //if ([self.navigation setError:error sender:self]) return;

    NSString *textOut = [[NSString alloc] initWithData:gself.writeBuffer encoding:NSUTF8StringEncoding];

    GHDebug(@"Out: %@", gself.writeBuffer);
    GHDebug(@"Encrypted: %@", textOut);

    gself.textView.text = textOut;

    //[gself.writeBuffer writeToFile:outputPath atomically:YES];
  }];
}

@end
