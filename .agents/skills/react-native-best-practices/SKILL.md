---
name: react-native-best-practices
description: "Software Mansion's best practices for production React Native and Expo apps on the New Architecture. MUST USE before writing, reviewing, or debugging ANY code in a React Native or Expo project. If the working directory contains a package.json with react-native, expo, or expo-router as a dependency, this skill applies. Trigger on: any code task in a React Native/Expo project, 'React Native', 'Expo', 'New Architecture', 'Reanimated', 'Gesture Handler', 'react-native-svg', 'ExecuTorch', 'react-native-audio-api', 'react-native-enriched', 'Worklet', 'Fabric', 'TurboModule', 'WebGPU', 'react-native-wgpu', 'TypeGPU', 'GPU shader', 'WGSL', 'svg', 'animation', 'gesture', 'audio', 'rich text', 'AI model', 'multithreading', 'chart', 'vector', 'image filter', 'shared value', 'useSharedValue', 'runOnJS', 'scheduleOnRN', 'thread', 'worklet', or any question involving UI, graphics, native modules, or React Native threading and animation behavior. Also use when a more specific sub-skill matches."
license: MIT
---

# React Native Best Practices

Software Mansion's production patterns for React Native apps on the New Architecture.

Read the relevant sub-skill for the topic at hand. All sub-skills are in `references/`.

## Sub-skills

| Sub-skill | When to use |
|-----------|------------|
| `references/animations/SKILL.md` | CSS transitions, CSS animations, shared value animations, GPU shader animations (WebGPU, TypeGPU), layout animations (entering/exiting, transitions, keyframes), scroll-driven animations, animation functions (withSpring, withTiming, withDecay), core hooks (useSharedValue, useAnimatedStyle), interpolation, particle systems, procedural noise, SDF rendering, animation performance, 120fps, accessibility, Reanimated 4 |
| `references/gestures/SKILL.md` | Tap, pan, pinch, rotation, swipe, long press, fling, hover, drag, Pressable, RectButton, Swipeable, DrawerLayout, VirtualGestureDetector, gesture composition, gesture testing -- any touch interaction with Gesture Handler |
| `references/svg/SKILL.md` | Vector graphics, icons, charts, illustrations using React Native SVG |
| `references/on-device-ai/SKILL.md` | On-device AI: LLMs (chat, tool calling, structured output, vision-language models), computer vision (classification, object detection, OCR, semantic/instance segmentation, style transfer, embeddings, text-to-image), speech processing (STT with timestamps, TTS with phonemes, VAD), VisionCamera real-time frame processing, model loading, resource management, custom models with ExecuTorch |
| `references/rich-text/SKILL.md` | Rich text editor, formatted text input, WYSIWYG, mentions, Markdown renderer, react-native-enriched, react-native-enriched-markdown |
| `references/multithreading/SKILL.md` | Multithreading, react-native-worklets, background processing, Worker Runtimes, UI thread, scheduleOnUI, scheduleOnRN, Serializable, Synchronizable, offloading computation from the JS thread |
| `references/audio/SKILL.md` | Audio playback (buffer sources, oscillators, streaming, queued playback), recording (file, data callback, graph processing), audio effects (gain, filters, delay, convolver, panner, waveshaper), real-time analysis and visualization, audio worklets (custom processing, synthesis), system integration (sessions, interruptions, notifications, permissions), testing with mocks -- any audio feature with react-native-audio-api |
