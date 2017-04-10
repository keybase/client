//
//  KBPGPDecryptFileView.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPDecryptFileView.h"

#import "KBFileListView.h"
#import "KBFile.h"
#import "KBStream.h"
#import "KBPGPDecrypt.h"
#import "KBFileWriter.h"
#import "KBPGPOutputFileView.h"
#import "KBPGPDecryptFooterView.h"
#import "KBPGPDecrypted.h"
#import "KBWork.h"

@interface KBPGPDecryptFileView ()
@property KBFileListView *fileListView;
@property KBPGPDecrypt *decrypter;
@end

@implementation KBPGPDecryptFileView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  YOVBox *toolbarView = [YOVBox box];
  [self addSubview:toolbarView];

  YOHBox *buttonsView = [YOHBox box:@{@"insets": @(10)}];
  [toolbarView addSubview:buttonsView];
  [toolbarView addSubview:[KBBox horizontalLine]];

  YOSelf yself = self;
  KBButton *attachmentButton = [KBButton buttonWithText:@"Open files" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
  attachmentButton.targetBlock = ^{ [yself chooseInput]; };
  [buttonsView addSubview:attachmentButton];

  _fileListView = [[KBFileListView alloc] init];
  _fileListView.imageLabelStyle = KBImageLabelStyleLarge;
  _fileListView.onMenuSelect = ^(KBTableView *tableView, NSIndexPath *indexPath) {
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    [menu addItemWithTitle:@"Show In Finder" action:@selector(showInFinder:) keyEquivalent:@""];
    [menu addItemWithTitle:@"Remove" action:@selector(removeFile:) keyEquivalent:@""];
    return menu;
  };
  [self addSubview:_fileListView];

  KBPGPDecryptFooterView *footerView = [[KBPGPDecryptFooterView alloc] init];
  footerView.decryptButton.targetBlock = ^{ [self decrypt]; };
  [self addSubview:footerView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_fileListView top:@[toolbarView] bottom:@[footerView] insets:UIEdgeInsetsZero spacing:0];
}

- (void)setFiles:(NSArray *)files {
  [_fileListView addObjects:files animation:NSTableViewAnimationEffectNone];
}

- (void)showInFinder:(id)sender {
  KBFile *file = [_fileListView.dataSource objectAtIndexPath:_fileListView.menuIndexPath];
  [[NSWorkspace sharedWorkspace] activateFileViewerSelectingURLs:@[[NSURL fileURLWithPath:file.path]]];
}

- (void)removeFile:(id)sender {
  if (!_fileListView.menuIndexPath) return;
  [_fileListView.dataSource removeObjectAtIndexPath:_fileListView.menuIndexPath];
  [_fileListView reloadData];
}

- (void)addFile:(KBFile *)file {
  [_fileListView addObjects:@[file] animation:NSTableViewAnimationEffectNone];
}

- (void)decrypt {
  NSMutableArray *streams = [NSMutableArray array];
  KBFileOutput output = ^(NSString *path) {
    return [path stringByDeletingPathExtension];
  };
  [KBStream checkFiles:[_fileListView objects] index:0 output:output streams:streams skipCheck:NO view:self completion:^(NSError *error){
    if ([KBActivity setError:error sender:self]) return;
    if ([streams count] > 0) [self decryptStreams:streams];
  }];
}

- (void)decryptStreams:(NSArray *)streams {
  _decrypter = [[KBPGPDecrypt alloc] init];
  KBRPGPDecryptOptions *options = [[KBRPGPDecryptOptions alloc] init];

  [KBActivity setProgressEnabled:YES sender:self];
  [_decrypter decryptWithOptions:options streams:streams client:self.client sender:self completion:^(NSArray *works) {
    [KBActivity setProgressEnabled:NO sender:self];

    // TODO: Show errors in output, not just first error
    NSArray *errors = KBMap(works, error);
    if ([KBActivity setError:[errors firstObject] sender:self]) return;

    NSArray *decrypted = KBMap(works, output);
    [self showOutput:decrypted];
  }];
}

- (void)showOutput:(NSArray *)decrypted {
  KBPGPOutputFileView *outputView = [[KBPGPOutputFileView alloc] init];

  NSArray *streams = KBMap(decrypted, stream);

  [outputView setFiles:[streams map:^(KBStream *stream) { return [KBFile fileWithPath:((KBFileWriter *)stream.writer).path]; }]];
  [self.navigation pushView:outputView animated:YES];
}

- (void)chooseInput {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.prompt = @"OK";
  panel.title = @"Choose a file...";
  panel.allowsMultipleSelection = YES;
  //GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      for (NSURL *URL in [panel URLs]) {
        if ([URL isFileURL]) {
          [self addFile:[KBFile fileWithURL:URL]];
        }
      }
    }
  }];
}

@end

