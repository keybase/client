//
//  KBPGPSignFileView.m
//  Keybase
//
//  Created by Gabriel on 3/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPSignFileView.h"

#import "KBRPC.h"
#import "KBStream.h"
#import "KBPGPOutputView.h"
#import "KBPGPSigner.h"
#import "KBPGPSignFooterView.h"
#import "KBFileIcon.h"
#import "KBFileReader.h"
#import "KBPGPOutputFileView.h"
#import "KBWork.h"

@interface KBPGPSignFileView ()
@property KBButton *chooseButton;
@property KBFileIcon *fileIcon;
@property KBPGPSignFooterView *footerView;
@property KBPGPSigner *signer;
@end

@implementation KBPGPSignFileView

- (void)viewInit {
  [super viewInit];

  YOView *contentView = [YOView view];
  [contentView kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  [self addSubview:contentView];

  _fileIcon = [[KBFileIcon alloc] init];
  _fileIcon.iconHeight = 400;
  _fileIcon.font = [NSFont systemFontOfSize:18];
  [contentView addSubview:_fileIcon];

  YOSelf yself = self;
  KBButton *chooseButton = [KBButton buttonWithText:@"Choose File" style:KBButtonStyleDefault options:0];
  chooseButton.targetBlock = ^{ [yself chooseInput]; };
  [contentView addSubview:chooseButton];

  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    if (yself.fileIcon.file) {
      y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, size.height - y - 80) view:yself.fileIcon].size.height + 20;
    }
    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, size.height - y - 20) view:chooseButton].size.height + 20;
    return size;
  }];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPSignFooterView alloc] init];
  _footerView.clearSign.hidden = YES;
  _footerView.signButton.targetBlock = ^{ [gself sign]; };
  [self addSubview:_footerView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:contentView top:nil bottom:@[_footerView] insets:UIEdgeInsetsZero spacing:0];
}

- (void)sign {
  if (_footerView.detached.state == NSOnState) {
    [self signDetached];
  } else {
    [self signAttached];
  }
}

- (void)signDetached {
  KBRPGPSignOptions *options = [[KBRPGPSignOptions alloc] init];
  options.binaryIn = YES;
  options.binaryOut = NO;
  options.mode = KBRSignModeDetached;

  KBFileReader *fileReader = [KBFileReader fileReaderWithPath:_fileIcon.file.path];
  KBWriter *writer = [KBWriter writer];
  KBStream *stream = [KBStream streamWithReader:fileReader writer:writer label:arc4random()];
  [self signStream:stream options:options];
}

- (void)signAttached {
  KBRPGPSignOptions *options = [[KBRPGPSignOptions alloc] init];
  options.mode = KBRSignModeAttached;
  options.binaryIn = YES;
  options.binaryOut = YES;

  NSMutableArray *streams = [NSMutableArray array];
  KBFileOutput output = ^(NSString *path) {
    return [path stringByAppendingPathExtension:@"gpg"];
  };
  [KBStream checkFiles:@[_fileIcon.file] index:0 output:output streams:streams skipCheck:NO view:self completion:^(NSError *error) {
    if ([KBActivity setError:error sender:self]) return;
    if ([streams count] > 0) [self signStream:[streams firstObject] options:options];
  }];
}

- (void)signStream:(KBStream *)stream options:(KBRPGPSignOptions *)options {
  _signer = [[KBPGPSigner alloc] init];
  [KBActivity setProgressEnabled:YES sender:self];
  [_signer signWithOptions:options streams:@[stream] client:self.client sender:self completion:^(NSArray *works) {
    [KBActivity setProgressEnabled:NO sender:self];
    KBWork *work = works[0];
    NSError *error = [work error];
    KBStream *stream = [work output];
    if ([KBActivity setError:error sender:self]) return;
    [self showOutput:stream.writer];
  }];
}

- (void)chooseInput {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.prompt = @"OK";
  panel.title = @"Choose a file...";
  panel.allowsMultipleSelection = YES;
  GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      for (NSURL *URL in [panel URLs]) {
        if ([URL isFileURL]) {
          [gself.fileIcon setFile:[KBFile fileWithURL:URL]];
          [self setNeedsLayout];
        }
      }
    }
  }];
}

- (void)showOutput:(id<KBWriter>)writer {
  if ([writer data]) {
    KBPGPOutputView *outputView = [[KBPGPOutputView alloc] init];
    NSString *text = [[NSString alloc] initWithData:[writer data] encoding:NSUTF8StringEncoding];
    [outputView setText:text wrap:NO];
    [self.navigation pushView:outputView animated:YES];
  } else if ([writer path]) {
    KBPGPOutputFileView *outputView = [[KBPGPOutputFileView alloc] init];
    [outputView setFiles:@[[KBFile fileWithPath:[writer path]]]];
    [self.navigation pushView:outputView animated:YES];
  }
}

@end
