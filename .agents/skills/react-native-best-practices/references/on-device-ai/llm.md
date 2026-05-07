# LLM Patterns

Production patterns for running LLMs on-device with `useLLM`. For the full hook API, webfetch [useLLM docs](https://docs.swmansion.com/react-native-executorch/docs/hooks/natural-language-processing/useLLM). For all available model constants, webfetch the [API reference](https://docs.swmansion.com/react-native-executorch/docs/api-reference).

For model loading strategies and resource fetcher setup, see **`setup.md`**.

---

## Model Selection

Choose based on device constraints and task complexity. All models ship as quantized variants.

| Model Family | Sizes | Best for |
|---|---|---|
| SmolLM 2 | 135M, 360M, 1.7B | Low-end devices, simple tasks |
| Qwen 2.5 / Qwen 3 | 0.5B-4B | General chat, reasoning (Qwen 3 supports `/no_think` to disable reasoning) |
| LLaMA 3.2 | 1B, 3B | General chat |
| Hammer 2.1 | 0.5B-3B | Tool calling |
| Phi 4 Mini | 4B | Complex reasoning (high-end devices only) |
| LFM2.5 | 1.2B | General chat, instruction following |
| LFM2.5-VL | 1.6B | Vision-language (image + text understanding) |

**Device limits:** Low-end devices handle 135M-1.7B parameters. High-end devices (iPhone 15 Pro, Pixel 8 Pro) can run 3B-4B parameter models. Always test on the lowest-spec device you plan to support.

For full model list and download URLs, webfetch [LLM models](https://docs.swmansion.com/react-native-executorch/docs/api-reference#models---lmm).

---

## Functional vs Managed

`useLLM` supports two usage modes:

| Mode | Method | State management | Tool calling |
|---|---|---|---|
| **Functional** | `generate(messages)` | You manage conversation history | You parse tool calls from output |
| **Managed** | `sendMessage(text)` | Hook tracks `messageHistory` | Automatic via `executeToolCallback` |

Use **functional** for full control or custom conversation flows. Use **managed** for standard chat UIs where the hook should handle message history and tool execution.

---

## Functional Mode

### Basic chat completion

Pass a `Message[]` array to `generate`. The `response` property updates with each token. The returned Promise resolves to the complete response.

```tsx
import { useLLM, LLAMA3_2_1B } from 'react-native-executorch';

function Chat() {
  const llm = useLLM({ model: LLAMA3_2_1B });

  const handleGenerate = async () => {
    const chat: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the capital of France?' },
    ];

    const response = await llm.generate(chat);
    console.log('Complete:', response);
  };

  return (
    <View>
      <Button onPress={handleGenerate} title="Ask" disabled={!llm.isReady} />
      <Text>{llm.response}</Text>
    </View>
  );
}
```

### Tool calling (functional)

Pass tool definitions as the second argument to `generate`. Parse the response in a `useEffect` to detect tool calls:

```tsx
const TOOLS: LLMTool[] = [
  {
    name: 'get_weather',
    description: 'Get weather in a location.',
    parameters: {
      type: 'dict',
      properties: {
        location: { type: 'string', description: 'City name' },
      },
      required: ['location'],
    },
  },
];

const llm = useLLM({ model: HAMMER2_1_1_5B });

const ask = () => {
  const chat: Message[] = [
    { role: 'system', content: `You are a helpful assistant. Current date: ${new Date().toString()}` },
    { role: 'user', content: "What's the weather in Cracow?" },
  ];
  llm.generate(chat, TOOLS);
};

useEffect(() => {
  // Parse llm.response for tool call JSON and execute accordingly
}, [llm.response]);
```

Use Hammer 2.1 models for tool calling. Their chat template supports the tool calling format. If a model does not support tool calling natively, you can work around it by describing tool schemas in the system prompt.

---

## Managed Mode

### Configure and send messages

Call `configure` once to set up the system prompt, conversation history, context strategy, tool callbacks, and generation parameters. Then use `sendMessage` for each user message:

```tsx
import {
  useLLM,
  LLAMA3_2_1B,
  MessageCountContextStrategy,
} from 'react-native-executorch';

const llm = useLLM({ model: LLAMA3_2_1B });

const { configure } = llm;
useEffect(() => {
  configure({
    chatConfig: {
      systemPrompt: 'You are a helpful translator.',
      contextStrategy: new MessageCountContextStrategy(6),
    },
    generationConfig: {
      temperature: 0.7,
      topp: 0.9,
      outputTokenBatchSize: 15,
      batchTimeInterval: 100,
    },
  });
}, [configure]);

const send = (text: string) => llm.sendMessage(text);
```

### Context strategy

The `contextStrategy` field in `chatConfig` controls how conversation history is managed for context. Three built-in strategies are available:

- `SlidingWindowContextStrategy` (default): trims oldest messages to fit a sliding window.
- `MessageCountContextStrategy(n)`: keeps the last `n` messages from the conversation.
- `NoopContextStrategy`: no trimming, passes the entire history every time.

You can also implement a custom strategy using the `ContextStrategy` interface.

### Initial message history

Provide `initialMessageHistory` in `chatConfig` to seed the conversation with prior context:

```tsx
llm.configure({
  chatConfig: {
    systemPrompt: 'You are a helpful assistant.',
    initialMessageHistory: [
      { role: 'user', content: 'What is the current time and date?' },
    ],
    contextStrategy: new MessageCountContextStrategy(6),
  },
});
```

### Tool calling (managed)

In managed mode, tool calls are parsed and executed automatically via the `executeToolCallback`:

```tsx
const llm = useLLM({ model: HAMMER2_1_1_5B });

useEffect(() => {
  llm.configure({
    chatConfig: {
      systemPrompt: `You are a helpful assistant. Current date: ${new Date().toString()}`,
    },
    toolsConfig: {
      tools: TOOLS,
      executeToolCallback: async (call) => {
        if (call.toolName === 'get_weather') {
          const result = await fetchWeather(call.parameters.location);
          return JSON.stringify(result);
        }
        return null;
      },
      displayToolCalls: true,
    },
  });
}, []);

// Tool results are automatically fed back to the model
llm.sendMessage("What's the weather in Cracow?");
```

### Conversation history

Access the full conversation via `messageHistory`:

```tsx
{llm.messageHistory.map((msg, i) => (
  <Text key={i}>{msg.role}: {msg.content}</Text>
))}
```

Use `deleteMessage` to remove specific messages from history.

---

## Vision-Language Models (VLM)

Some models support multimodal input (text and images together). Load a VLM model and pass images alongside text:

### Loading a VLM

```tsx
import { useLLM, LFM2_VL_1_6B_QUANTIZED } from 'react-native-executorch';

const llm = useLLM({ model: LFM2_VL_1_6B_QUANTIZED });
```

The `capabilities` field is already set on the model constant. You can also construct the model object explicitly:

```tsx
const llm = useLLM({
  model: {
    modelSource: '...',
    tokenizerSource: '...',
    tokenizerConfigSource: '...',
    capabilities: ['vision'],
  },
});
```

### Sending a message with an image (managed)

```tsx
llm.sendMessage('What is in this image?', {
  imagePath: '/path/to/image.jpg',
});
```

The `imagePath` should be a local file path on the device.

### Functional generation with images

Set `mediaPath` on user messages:

```tsx
const chat: Message[] = [
  {
    role: 'user',
    content: 'Describe this image.',
    mediaPath: '/path/to/image.jpg',
  },
];

const response = await llm.generate(chat);
```

---

## Structured Output

Force the LLM to respond with JSON matching a schema. Works with JSON Schema or Zod:

```tsx
import { Schema } from 'jsonschema';
import {
  useLLM,
  QWEN3_4B_QUANTIZED,
  getStructuredOutputPrompt,
  fixAndValidateStructuredOutput,
} from 'react-native-executorch';

const schema: Schema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'User name' },
    intent: { type: 'string', description: 'User intent' },
  },
  required: ['name', 'intent'],
};

const llm = useLLM({ model: QWEN3_4B_QUANTIZED });

useEffect(() => {
  const formatting = getStructuredOutputPrompt(schema);
  llm.configure({
    chatConfig: {
      systemPrompt: `Parse user messages into JSON.\n${formatting}\n/no_think`,
    },
  });
}, []);

// After generation completes:
useEffect(() => {
  const last = llm.messageHistory.at(-1);
  if (!llm.isGenerating && last?.role === 'assistant') {
    try {
      const parsed = fixAndValidateStructuredOutput(last.content, schema);
      console.log(parsed);
    } catch (e) {
      console.error('Output does not match schema:', e);
    }
  }
}, [llm.messageHistory, llm.isGenerating]);
```

### Zod schemas

Zod schemas are also supported via `zod/v4`. Use `z.meta()` for field descriptions:

```tsx
import * as z from 'zod/v4';

const responseSchema = z.object({
  username: z.string().meta({ description: 'Name of user' }),
  question: z.optional(z.string().meta({ description: 'Question that user asks' })),
  bid: z.number().meta({ description: 'Amount of money offered' }),
});

const formatting = getStructuredOutputPrompt(responseSchema);
// fixAndValidateStructuredOutput with Zod returns typed output
const parsed = fixAndValidateStructuredOutput(lastMessage.content, responseSchema);
```

The `/no_think` suffix disables Qwen 3's reasoning mode, producing cleaner JSON output.

---

## Token Batching

On fast devices, the LLM can generate 60+ tokens per second. Updating React state on every token causes jank. Token batching groups tokens before emitting them:

```tsx
llm.configure({
  generationConfig: {
    outputTokenBatchSize: 15,  // emit after 15 tokens
    batchTimeInterval: 100,    // or after 100ms, whichever comes first
  },
});
```

Defaults: 10 tokens, 80ms interval (~12 batches per second). Increase `batchTimeInterval` on slower devices for smoother UI. Decrease `outputTokenBatchSize` for faster perceived response on high-end devices.

---

## Token Counting

Track token usage with the counting methods:

```tsx
const generatedTokens = llm.getGeneratedTokenCount();
const promptTokens = llm.getPromptTokenCount();
const totalTokens = llm.getTotalTokenCount();
```

---

## Interrupting Generation

Call `interrupt()` to stop generation mid-stream. The `response` updates one final time with the partial output:

```tsx
<Button
  title="Stop"
  onPress={() => llm.interrupt()}
  disabled={!llm.isGenerating}
/>
```

**You must interrupt before unmounting.** Unmounting a component while `isGenerating` is true crashes the app. Guard navigation:

```tsx
useEffect(() => {
  return () => {
    if (llm.isGenerating) {
      llm.interrupt();
    }
  };
}, []);
```

---

## Gotchas

- `chatConfig` and `toolsConfig` only affect managed mode (`sendMessage`). They have no effect on functional mode (`generate`).
- `generate` and `sendMessage` cannot run concurrently. Calling either while the other is running throws `ModelGenerating`.
- `topp` must be between 0 and 1 (inclusive). Values outside this range throw `InvalidConfig`.
- GGUF models are not supported. ExecuTorch uses the `.pte` format exclusively.
- Most models run on the XNNPACK CPU backend. GPU acceleration via Core ML is available for some iOS models but coverage is limited.
- iOS simulator release builds are not supported. Test release builds on real devices.
- Qwen 3 enables reasoning by default. Append `/no_think` to the user prompt to disable it for faster, more concise responses.
