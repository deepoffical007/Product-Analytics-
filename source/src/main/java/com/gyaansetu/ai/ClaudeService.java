package com.gyaansetu.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlock;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import com.gyaansetu.db.Config;

import java.time.Duration;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * Calls Claude through the official Anthropic Java SDK. Only active when ANTHROPIC_API_KEY
 * (or ANTHROPIC_AUTH_TOKEN) is set on the server; otherwise callers use {@link OfflineAi}.
 */
public final class ClaudeService {
    private static final Logger LOG = Logger.getLogger(ClaudeService.class.getName());
    private static volatile AnthropicClient client;

    private ClaudeService() {}

    /** One turn of a conversation: role is "user" or "assistant". */
    public record Turn(String role, String content) {}

    /** Thrown when Claude could not produce an answer; message is safe to show to users. */
    public static final class AiUnavailable extends Exception {
        public AiUnavailable(String message) { super(message); }
    }

    public static boolean enabled() { return Config.aiKeyPresent(); }

    public static String model() { return Config.aiModel(); }

    private static AnthropicClient client() {
        if (client == null) {
            synchronized (ClaudeService.class) {
                if (client == null) {
                    client = AnthropicOkHttpClient.builder().fromEnv().timeout(Duration.ofSeconds(90)).maxRetries(1).build();
                }
            }
        }
        return client;
    }

    public static String ask(String prompt) throws AiUnavailable {
        return chat(List.of(new Turn("user", prompt)));
    }

    public static String chat(List<Turn> turns) throws AiUnavailable {
        if (!enabled()) throw new AiUnavailable("AI key not configured");
        MessageCreateParams.Builder b = MessageCreateParams.builder()
                .model(model())
                .maxTokens(8000L)
                .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
                // Server-side fallback: if a safety classifier declines, the API retries on a suitable model.
                .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"));
        for (Turn t : turns) {
            if ("assistant".equals(t.role())) b.addAssistantMessage(t.content());
            else b.addUserMessage(t.content());
        }
        try {
            Message m = client().messages().create(b.build());
            if (m.stopReason().isPresent() && m.stopReason().get().equals(StopReason.REFUSAL)) {
                throw new AiUnavailable("The assistant declined this request. Try rephrasing it.");
            }
            String text = m.content().stream().flatMap(block -> block.text().stream()).map(TextBlock::text)
                    .collect(Collectors.joining()).trim();
            if (text.isEmpty()) throw new AiUnavailable("The assistant returned an empty answer.");
            return text;
        } catch (RateLimitException e) {
            throw new AiUnavailable("Too many AI requests right now. Wait a minute and try again.");
        } catch (AnthropicServiceException e) {
            LOG.log(Level.WARNING, "Claude API error " + e.statusCode(), e);
            throw new AiUnavailable("The AI service returned an error (" + e.statusCode() + ").");
        } catch (AiUnavailable e) {
            throw e;
        } catch (RuntimeException e) {
            LOG.log(Level.WARNING, "Claude call failed", e);
            throw new AiUnavailable("Could not reach the AI service.");
        }
    }

    /** Asks for JSON and parses the reply tolerantly (whole reply, a fenced block, or first bracket to last). */
    public static JsonElement askJson(String prompt) throws AiUnavailable {
        String text = ask(prompt + "\n\nReply with only the JSON value, no other text.");
        JsonElement parsed = parseLoose(text);
        if (parsed == null) throw new AiUnavailable("The AI answer was not in the expected format.");
        return parsed;
    }

    static JsonElement parseLoose(String text) {
        String t = text.trim();
        if (t.startsWith("```")) {
            int nl = t.indexOf('\n');
            int end = t.lastIndexOf("```");
            if (nl > 0 && end > nl) t = t.substring(nl + 1, end).trim();
        }
        try { return JsonParser.parseString(t); } catch (RuntimeException ignored) { }
        int a = indexOfAny(t, '{', '['), z = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
        if (a < 0 || z <= a) return null;
        try { return JsonParser.parseString(t.substring(a, z + 1)); } catch (RuntimeException e) { return null; }
    }

    private static int indexOfAny(String s, char x, char y) {
        int i = s.indexOf(x), j = s.indexOf(y);
        if (i < 0) return j;
        if (j < 0) return i;
        return Math.min(i, j);
    }
}
