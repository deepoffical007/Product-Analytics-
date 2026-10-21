package com.gyaansetu.engine;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Ranking: BM25 relevance (with synonym expansion, prefix and one-typo matching) blended with
 * Bayesian rating, comment sentiment + helpful votes, likes per view, log views and personal affinity.
 * score = sum(w_i * s_i) / sum(w_i), every signal s_i scaled to 0..1.
 */
public final class Ranker {
    public static final String[] SIGNALS = {"rel", "rating", "feedback", "eng", "pop", "personal"};
    public static final Map<String, Integer> DEFAULT_WEIGHTS = Map.of("rel", 40, "rating", 20, "feedback", 15, "eng", 15, "pop", 10, "personal", 5);
    private static final double K1 = 1.2, B = 0.75, LIKE_M = 20000, RATING_M = 25;

    private Ranker() {}

    /** Live engagement numbers for one resource, read from the database. */
    public static final class Stats {
        public long views, likes;
        public double ratingSum;
        public int ratingCount, helpfulYes, helpfulNo, reviewCount, positiveCount;
        public double sentimentSum;

        public double avgRating() { return ratingCount == 0 ? 0 : ratingSum / ratingCount; }
    }

    /** What a signed-in user has engaged with: subject and tag weights. */
    public static final class Profile {
        public final Map<String, Double> subjects = new HashMap<>();
        public final Map<String, Double> tags = new HashMap<>();
        public double total;

        public void add(Resource r, double w) {
            if (w <= 0) return;
            total += w;
            subjects.merge(r.subject, w, Double::sum);
            for (String t : r.tags) tags.merge(t, w, Double::sum);
        }
    }

    public record Query(String raw, List<String> toks, Map<String, Double> terms, List<String> expanded, List<String> words) {}

    public static final class Filters {
        public Set<String> types = new HashSet<>();
        public String subject = "", level = "", sort = "best";
        public double minRating = 0;
        public long minViews = 0;
    }

    public static final class Scored {
        public final Resource r;
        public final Stats s;
        public double rel, rating, feedback, eng, pop, personal, bayes, helpful, sentiment, positive, score;
        public final Map<String, Double> parts = new LinkedHashMap<>();

        Scored(Resource r, Stats s) { this.r = r; this.s = s; }

        public double signal(String k) {
            return switch (k) {
                case "rel" -> rel; case "rating" -> rating; case "feedback" -> feedback;
                case "eng" -> eng; case "pop" -> pop; case "personal" -> personal; default -> 0;
            };
        }
    }

    public record Result(Query query, List<Scored> rows, List<Scored> matched) {}

    public static Query parse(String q) {
        String raw = Text.norm(q);
        if (raw.isEmpty()) return null;
        List<String> toks = Text.tokenize(raw);
        if (toks.isEmpty()) return null;
        Map<String, Double> terms = new LinkedHashMap<>();
        toks.forEach(t -> terms.put(t, 1.0));
        String padded = " " + raw.replace("'", "") + " ";
        Set<String> expanded = new LinkedHashSet<>();
        Catalog.SYNONYMS.forEach((key, related) -> {
            if (!padded.contains(" " + key + " ")) return;
            for (String p : related) {
                if (padded.contains(" " + p + " ")) continue;
                expanded.add(p);
                for (String t : Text.tokenize(p)) terms.putIfAbsent(t, 0.45);
            }
        });
        List<String> words = new ArrayList<>();
        for (String w : raw.split(" ")) if (w.length() >= 2 && w.matches("[a-z0-9]+") && !Text.STOP.contains(w)) words.add(w);
        return new Query(raw, toks, terms, new ArrayList<>(expanded), words);
    }

    static double relevance(Catalog c, Resource r, Query q) {
        double s = 0;
        Set<String> matched = new HashSet<>();
        int n = c.items.size();
        for (Map.Entry<String, Double> e : q.terms().entrySet()) {
            String t = e.getKey();
            double qw = e.getValue();
            double f = r.tf.getOrDefault(t, 0.0);
            int dfT = c.df.getOrDefault(t, 0);
            if (f == 0 && t.length() >= 3) {
                double best = 0; String bestTok = null;
                for (Map.Entry<String, Double> tok : r.tf.entrySet()) {
                    double v = 0;
                    if (tok.getKey().startsWith(t)) v = tok.getValue() * 0.7;
                    else if (t.length() >= 5 && Text.lev1(t, tok.getKey())) v = tok.getValue() * 0.55;
                    if (v > best) { best = v; bestTok = tok.getKey(); }
                }
                if (best > 0) { f = best; dfT = c.df.getOrDefault(bestTok, 1); }
            }
            if (f == 0) continue;
            if (qw == 1.0) matched.add(t);
            double idf = Math.log(1 + (n - dfT + 0.5) / (dfT + 0.5));
            s += qw * idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * r.dl / c.avgdl));
        }
        if (s == 0) return 0;
        if (q.toks().size() > 1) {
            String hay = " " + Text.norm(r.title + " " + String.join(" ", r.tags)) + " ";
            if (hay.contains(" " + q.raw() + " ")) s *= 1.3;
        }
        return s * (0.5 + 0.5 * matched.size() / (double) new HashSet<>(q.toks()).size());
    }

    private record Globals(double likeRate, double meanRating, long maxViews, double engRef) {}

    private static Globals globals(Catalog c, Map<String, Stats> stats) {
        double likes = 0, views = 0, ratings = 0; long maxViews = 1;
        for (Resource r : c.items) {
            Stats s = stats.getOrDefault(r.id, new Stats());
            likes += s.likes; views += s.views; ratings += s.avgRating();
            maxViews = Math.max(maxViews, s.views);
        }
        double likeRate = views == 0 ? 0 : likes / views;
        double engRef = 1e-9;
        for (Resource r : c.items) {
            Stats s = stats.getOrDefault(r.id, new Stats());
            engRef = Math.max(engRef, (s.likes + LIKE_M * likeRate) / (s.views + LIKE_M));
        }
        return new Globals(likeRate, c.items.isEmpty() ? 4 : ratings / c.items.size(), maxViews, engRef);
    }

    private static Scored signals(Resource r, Stats s, Profile p, Globals g) {
        Scored x = new Scored(r, s);
        double likeS = (s.likes + LIKE_M * g.likeRate()) / (s.views + LIKE_M);
        x.bayes = (g.meanRating() * RATING_M + s.ratingSum) / (RATING_M + s.ratingCount);
        double sentPart = (s.sentimentSum / (s.reviewCount + 1) + 1) / 2;
        x.helpful = (s.helpfulYes + 1.0) / (s.helpfulYes + s.helpfulNo + 2.0);
        x.sentiment = s.reviewCount == 0 ? 0 : s.sentimentSum / s.reviewCount;
        x.positive = s.reviewCount == 0 ? 0 : s.positiveCount / (double) s.reviewCount;
        x.rating = Math.max(0, Math.min(1, (x.bayes - 1) / 4));
        x.feedback = 0.6 * sentPart + 0.4 * x.helpful;
        x.eng = Math.min(1, likeS / g.engRef());
        x.pop = Math.log10(s.views + 1) / Math.log10(g.maxViews() + 1);
        if (p != null && p.total > 0) {
            double sm = p.subjects.getOrDefault(r.subject, 0.0) / p.total;
            double tm = r.tags.stream().filter(p.tags::containsKey).count() / (double) Math.max(1, r.tags.size());
            x.personal = Math.min(1, 0.5 * sm + 0.8 * tm);
        }
        return x;
    }

    private static void blend(Scored x, Map<String, Integer> w, boolean hasQuery, boolean hasProfile) {
        double tot = 0, sum = 0;
        for (String k : SIGNALS) {
            if (k.equals("rel") && !hasQuery) continue;
            if (k.equals("personal") && !hasProfile) continue;
            int wk = w.getOrDefault(k, 0);
            tot += wk;
            double part = wk * x.signal(k);
            x.parts.put(k, part);
            sum += part;
        }
        if (tot == 0) { x.score = 0; return; }
        final double t = tot;
        x.parts.replaceAll((k, v) -> v / t);
        x.score = sum / tot;
    }

    public static Result rank(Catalog c, String query, Filters f, Map<String, Integer> weights,
                              Map<String, Stats> stats, Profile profile) {
        Query q = parse(query);
        boolean hasProfile = profile != null && profile.total > 0;
        Globals g = globals(c, stats);
        List<Scored> rows = new ArrayList<>();
        double maxRel = 0;
        Map<String, Double> rels = new HashMap<>();
        if (q != null) {
            for (Resource r : c.items) {
                double rel = relevance(c, r, q);
                rels.put(r.id, rel);
                maxRel = Math.max(maxRel, rel);
            }
        }
        for (Resource r : c.items) {
            if (q != null) {
                double rel = rels.get(r.id);
                if (rel <= 0 || rel < maxRel * 0.12) continue;
            }
            Scored x = signals(r, stats.getOrDefault(r.id, new Stats()), profile, g);
            x.rel = q == null ? 0 : (maxRel == 0 ? 0 : rels.get(r.id) / maxRel);
            blend(x, weights, q != null, hasProfile);
            rows.add(x);
        }
        List<Scored> matched = List.copyOf(rows);
        List<Scored> filtered = new ArrayList<>();
        for (Scored x : rows) {
            if (!f.types.isEmpty() && !f.types.contains(x.r.type)) continue;
            if (!f.subject.isEmpty() && !f.subject.equals(x.r.subject)) continue;
            if (!f.level.isEmpty() && !f.level.equals(x.r.level)) continue;
            if (f.minRating > 0 && x.s.avgRating() < f.minRating) continue;
            if (f.minViews > 0 && x.s.views < f.minViews) continue;
            filtered.add(x);
        }
        Comparator<Scored> cmp = switch (f.sort) {
            case "rating" -> Comparator.comparingDouble((Scored x) -> x.bayes).reversed();
            case "likes" -> Comparator.comparingLong((Scored x) -> x.s.likes).reversed();
            case "views" -> Comparator.comparingLong((Scored x) -> x.s.views).reversed();
            case "newest" -> Comparator.comparing((Scored x) -> x.r.date == null ? "" : x.r.date).reversed();
            default -> Comparator.comparingDouble((Scored x) -> x.score).reversed();
        };
        filtered.sort(cmp.thenComparing(x -> x.r.id));
        return new Result(q, filtered, matched);
    }

    public static String quality(double score) {
        return score >= 0.85 ? "Excellent" : score >= 0.72 ? "Very good" : score >= 0.58 ? "Good" : "Fair";
    }
}
