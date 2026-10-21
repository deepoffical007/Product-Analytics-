package com.gyaansetu.ai;

import com.gyaansetu.engine.Text;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.regex.Pattern;

/** Rule-based study helpers used when no Claude API key is configured or the API call fails. */
public final class OfflineAi {
    private OfflineAi() {}

    public static String summary(String text) {
        List<String> s = Text.extractive(text, 4);
        StringBuilder out = new StringBuilder(String.join(" ", s)).append("\n\n## Key terms\n");
        for (String k : Text.keywords(text, 6)) out.append("- **").append(k).append("**\n");
        return out.toString().trim();
    }

    public static String keyPoints(String text) {
        StringBuilder out = new StringBuilder("## Key Points\n");
        for (String s : Text.extractive(text, 7)) out.append("- ").append(s).append('\n');
        return out.toString().trim();
    }

    /** Fill-in-the-blank questions built from keyword sentences. */
    public static List<Map<String, Object>> quiz(String text, long seed) {
        List<String> kws = Text.keywords(text, 14);
        List<String> ss = Text.sentences(text);
        Random rnd = new Random(seed);
        List<Map<String, Object>> items = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (String kw : kws) {
            Pattern p = Pattern.compile("\\b" + Pattern.quote(kw) + "\\b", Pattern.CASE_INSENSITIVE);
            String sentence = ss.stream().filter(x -> p.matcher(x).find() && !used.contains(x)).findFirst().orElse(null);
            if (sentence == null) continue;
            used.add(sentence);
            List<String> others = new ArrayList<>(kws);
            others.remove(kw);
            Collections.shuffle(others, rnd);
            List<String> options = new ArrayList<>(others.subList(0, Math.min(3, others.size())));
            options.add(kw);
            Collections.shuffle(options, rnd);
            Map<String, Object> q = new LinkedHashMap<>();
            q.put("q", "Fill in the blank: " + p.matcher(sentence).replaceFirst("_____"));
            q.put("options", options);
            q.put("answer", options.indexOf(kw));
            q.put("why", "The original sentence: “" + sentence + "”");
            items.add(q);
            if (items.size() == 5) break;
        }
        return items;
    }

    public static String answer(String material, String question) {
        Set<String> qt = new HashSet<>(Text.tokenize(question));
        record Hit(String s, long v) {}
        List<Hit> hits = new ArrayList<>();
        for (String s : Text.sentences(material)) {
            long v = Text.tokenize(s).stream().filter(qt::contains).count();
            if (v > 0) hits.add(new Hit(s, v));
        }
        hits.sort((a, b) -> Long.compare(b.v(), a.v()));
        if (hits.isEmpty()) return "I could not find this in your material. Try different words, or add an API key on the server for full AI answers.";
        StringBuilder out = new StringBuilder("From your material:\n");
        hits.stream().limit(2).forEach(h -> out.append("- ").append(h.s()).append('\n'));
        return out.toString().trim();
    }

    public static String forumAnswer(String question, List<String> relatedTitles) {
        String lower = question.toLowerCase(Locale.ROOT);
        StringBuilder out = new StringBuilder("Here are resources on GyaanSetu that cover this topic");
        out.append(lower.endsWith("?") ? ":" : ".").append('\n');
        for (String t : relatedTitles) out.append("- **").append(t).append("**\n");
        out.append("\nStart with the first one, then post what is still unclear so others can help.");
        return out.toString();
    }
}
