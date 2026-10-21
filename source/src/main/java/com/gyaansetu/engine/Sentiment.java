package com.gyaansetu.engine;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Lexicon-based sentiment scorer with negation and intensifier handling. Returns a value in -1..1. */
public final class Sentiment {
    private static final Map<String, Double> LEX = new HashMap<>();
    private static final Set<String> NEGATORS = new HashSet<>(Arrays.asList(
            "not", "no", "never", "isn't", "wasn't", "don't", "doesn't", "didn't", "hardly", "can't", "won't", "nothing", "nor"));
    private static final Set<String> INTENSIFIERS = new HashSet<>(Arrays.asList(
            "very", "really", "so", "extremely", "super", "highly", "incredibly", "too"));

    static {
        String pos = "great:2 excellent:3 clear:2 clearly:2 helpful:2 amazing:3 best:3 love:3 perfect:3 useful:2 brilliant:3 intuitive:2 "
                + "easy:1.5 thorough:2 recommend:2 fantastic:3 awesome:3 good:1.5 beautiful:2 beautifully:2 finally:1 understood:1.5 "
                + "saved:2 engaging:2 fun:1.5 informative:2 accurate:2 rigorous:1.5 classic:1.5 definitive:2 insight:2 worth:1.5 rewarding:2 "
                + "thank:2 thanks:2 enjoyed:2 nice:1.5 balanced:1.5 organised:1.5 organized:1.5 entertaining:1.5 well:1 like:1 timeless:2 authoritative:2";
        String neg = "confusing:-2 boring:-2 wrong:-2.5 outdated:-1.5 dated:-1 bad:-2 terrible:-3 useless:-3 misleading:-3 clickbait:-3 slow:-1 "
                + "errors:-2 error:-2 hard:-1 poor:-2 waste:-3 shallow:-2 incorrect:-2.5 mistakes:-2 rushed:-1.5 dry:-1 biased:-1.5 "
                + "abstract:-1 dense:-1 small:-0.5 simplifies:-0.5 worse:-2 worst:-3 hate:-3 broken:-2 unclear:-2 difficult:-1 heavy:-0.5";
        for (String e : (pos + " " + neg).split(" ")) {
            String[] kv = e.split(":");
            LEX.put(kv[0], Double.parseDouble(kv[1]));
        }
    }

    private Sentiment() {}

    public static double score(String text) {
        if (text == null) return 0;
        List<String> toks = new ArrayList<>();
        for (String t : text.toLowerCase(Locale.ROOT).replace('’', '\'').split("[^a-z']+")) if (!t.isEmpty()) toks.add(t);
        double score = 0;
        for (int i = 0; i < toks.size(); i++) {
            Double v = LEX.get(toks.get(i));
            if (v == null) continue;
            double m = 1;
            if ((i > 0 && NEGATORS.contains(toks.get(i - 1))) || (i > 1 && NEGATORS.contains(toks.get(i - 2)))) m = -0.8;
            if (i > 0 && INTENSIFIERS.contains(toks.get(i - 1))) m *= 1.5;
            score += v * m;
        }
        return Math.tanh(score / 3);
    }

    public static String label(double s) {
        return s > 0.15 ? "Positive" : s < -0.15 ? "Negative" : "Neutral";
    }
}
