//
//  KBPGPEncryptFilesView.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncryptFilesView.h"
#import "KBPGPEncrypt.h"
#import "KBFileReader.h"
#import "KBFileWriter.h"
#import "KBPGPEncryptFooterView.h"
#import "KBFileSelectView.h"
#import "KBFileIcon.h"
#import "KBFileListEditView.h"
#import "KBPGPOutputFileView.h"
#import "KBWork.h"
#import "KBUserPickerView.h"

@interface KBPGPEncryptFilesView () <KBUserPickerViewDelegate>
@property KBUserPickerView *userPickerView;
@property KBFileListEditView *fileListEditView;
@property KBPGPEncryptFooterView *footerView;

@property KBPGPEncrypt *encrypter;
@end

@implementation KBPGPEncryptFilesView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *topView = [YOVBox box];
  [self addSubview:topView];
  _userPickerView = [[KBUserPickerView alloc] init];
  _userPickerView.delegate = self;
  [topView addSubview:_userPickerView];
  [topView addSubview:[KBBox horizontalLine]];

  _fileListEditView = [[KBFileListEditView alloc] init];
  [self addSubview:_fileListEditView];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPEncryptFooterView alloc] init];
  _footerView.encryptButton.targetBlock = ^{ [gself encrypt]; };
  _footerView.signButton.state = NSOnState;
  _footerView.includeSelfButton.state = NSOnState;
  [self addSubview:_footerView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_fileListEditView top:@[topView] bottom:@[_footerView]];
}

- (void)layout {
  [super layout];
  NSView *centerView = _fileListEditView;
  [_userPickerView setSearchResultsFrame:CGRectMake(0, 1, centerView.bounds.size.width, centerView.bounds.size.height) inView:self];
}

- (void)setClient:(KBRPClient *)client {
  _client = client;
  _userPickerView.client = client;
}

- (void)addFile:(KBFile *)file {
  [_fileListEditView addFile:file];
}

- (void)encrypt {
  NSMutableArray *streams = [NSMutableArray array];
  KBFileOutput output = ^(NSString *path) { return [path stringByAppendingPathExtension:@"gpg"]; };
  [KBStream checkFiles:[_fileListEditView files] index:0 output:output streams:streams skipCheck:NO view:self completion:^(NSError *error) {
    if ([KBActivity setError:error sender:self]) return;
    if ([streams count] > 0) [self encryptStreams:streams];
  }];
}

- (void)encryptStreams:(NSArray *)streams {
  _encrypter = [[KBPGPEncrypt alloc] init];
  KBRPGPEncryptOptions *options = [[KBRPGPEncryptOptions alloc] init];
  options.recipients = _userPickerView.usernames;
  options.noSelf = _footerView.includeSelfButton.state != NSOnState;
  options.noSign = _footerView.signButton.state != NSOnState;
  options.binaryOut = YES;
  self.navigation.progressEnabled = YES;
  //GHWeakSelf gself = self;
  [_encrypter encryptWithOptions:options streams:streams client:self.client sender:self completion:^(NSArray *works) {
    self.navigation.progressEnabled = NO;

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

// This will let the user picker group grow if someone adds a lot of users
- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView {
  CGSize size = userPickerView.frame.size;
  CGSize sizeThatFits = [userPickerView sizeThatFits:self.frame.size];
  if (sizeThatFits.height > size.height) {
    [self layoutView];
  }
}

- (void)userPickerView:(KBUserPickerView *)userPickerView didUpdateSearch:(BOOL)visible { }

@end
