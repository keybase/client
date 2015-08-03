//
//  KBPGPSignFilesView.m
//  Keybase
//
//  Created by Gabriel on 5/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPSignFilesView.h"

#import "KBFileListEditView.h"
#import "KBPGPSignFooterView.h"
#import "KBPGPSigner.h"
#import "KBWork.h"
#import "KBPGPOutputFileView.h"
#import "KBFileWriter.h"
#import "KBFile.h"

@interface KBPGPSignFilesView ()
@property KBFileListEditView *fileListEditView;
@property KBPGPSignFooterView *footerView;

@property KBPGPSigner *signer;
@end

@implementation KBPGPSignFilesView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  _fileListEditView = [[KBFileListEditView alloc] init];
  [self addSubview:_fileListEditView];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPSignFooterView alloc] init];
  _footerView.signButton.targetBlock = ^{ [gself sign]; };
  _footerView.clearSign.hidden = YES;
  [self addSubview:_footerView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_fileListEditView top:nil bottom:@[_footerView] insets:UIEdgeInsetsZero spacing:0];
}

- (void)sign {
  NSMutableArray *streams = [NSMutableArray array];

  KBFileOutput output;
  if ([self isDetached]) {
    output = ^(NSString *path) { return [path stringByAppendingPathExtension:@"asc"]; };
  } else {
    output = ^(NSString *path) { return [path stringByAppendingPathExtension:@"gpg"]; };
  }
  [KBStream checkFiles:[_fileListEditView files] index:0 output:output streams:streams skipCheck:NO view:self completion:^(NSError *error) {
    if ([KBActivity setError:error sender:self]) return;
    if ([streams count] > 0) [self signStreams:streams];
  }];
}

- (BOOL)isDetached {
  return _footerView.detached.state == NSOnState;
}

- (void)signStreams:(NSArray *)streams {
  _signer = [[KBPGPSigner alloc] init];
  KBRPGPSignOptions *options = [[KBRPGPSignOptions alloc] init];

  if ([self isDetached]) {
    options.mode = KBRSignModeDetached;
    options.binaryIn = YES;
    options.binaryOut = NO;
  } else {
    options.mode = KBRSignModeAttached;
    options.binaryIn = YES;
    options.binaryOut = YES;
  }

  [KBActivity setProgressEnabled:YES sender:self];
  [_signer signWithOptions:options streams:streams client:self.client sender:self completion:^(NSArray *works) {
    [KBActivity setProgressEnabled:NO sender:self];
    // TODO: Show errors in output, not just first error
    NSArray *errors = [works map:^(KBWork *w) { return w.error; }];
    if ([KBActivity setError:[errors firstObject] sender:self]) return;

    [self showOutput:KBMap(works, output)];
  }];
}

- (void)showOutput:(NSArray *)streams {
  KBPGPOutputFileView *outputView = [[KBPGPOutputFileView alloc] init];
  [outputView setFiles:[streams map:^(KBStream *stream) { return [KBFile fileWithPath:((KBFileWriter *)stream.writer).path]; }]];
  [self.navigation pushView:outputView animated:YES];
}

@end

