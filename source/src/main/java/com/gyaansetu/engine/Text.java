package com.gyaansetu.engine;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Tokenising, light stemming, typo matching and sentence utilities shared by search and the offline AI. */
public final class Text {
    public static final Set<String> STOP = new HashSet<>(Arrays.asList(
            "the a an and or of to in on for with by is are it its this that as at be from your you how what about into i my me do does can".split(" ")));
    private static final Pattern SENTENCE = Pattern.compile("[^.!?]+[.!?]+|[^.!?]+$");

    private Text() {}

    public static String norm(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9']+", " ").trim();
    }

    public static String stem(String w) {
        if (w.length() > 4 && w.endsWith("ies")) return w.substring(0, w.length() - 3) + "y";
        if (w.length() > 5 && w.endsWith("ing")) return w.substring(0, w.length() - 3);
        if (w.length() > 4 && w.endsWith("ed")) return w.substring(0, w.length() - 2);
        if (w.length() > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.substring(0, w.length() - 1);
        return w;
    }

    public static List<String> tokenize(String s) {
        List<String> out = new ArrayList<>();
        if (s == null) return out;
        for (String t : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim().split(" ")) {
            if (t.length() >= 2 && !STOP.contains(t)) out.add(stem(t));
        }
        return out;
    }

    /** True when the edit distance between a and b is at most 1. */
    public static boolean lev1(String a, String b) {
        if (a.equals(b)) return true;
        int la = a.length(), lb = b.length();
        if (Math.abs(la - lb) > 1) return false;
        int i = 0, j = 0, edits = 0;
        while (i < la && j < lb) {
            if (a.charAt(i) == b.charAt(j)) { i++; j++; continue; }
            if (++edits > 1) return false;
            if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
        }
        return edits + (la - i) + (lb - j) <= 1;
    }

    public static List<String> sentences(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) return out;
        Matcher m = SENTENCE.matcher(text.replaceAll("\\s+", " "));
        while (m.find()) {
            String s = m.group().trim();
            if (s.split(" ").length >= 5) out.add(s);
        }
        return out;
    }

    public static List<String> keywords(String text, int n) {
        Map<String, Integer> tf = new HashMap<>();
        for (String w : text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9 ]+", " ").split("\\s+")) {
            if (w.length() > 3 && !STOP.contains(w)) tf.merge(w, 1, Integer::sum);
        }
        return tf.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(n).map(Map.Entry::getKey).toList();
    }

    /** Picks the n most keyword-dense sentences and returns them in original order. */
    public static List<String> extractive(String text, int n) {
        List<String> ss = sentences(text);
        Set<String> kws = new LinkedHashSet<>(keywords(text, 25));
        record Scored(String s, int i, double v) {}
        List<Scored> scored = new ArrayList<>();
        for (int i = 0; i < ss.size(); i++) {
            String s = ss.get(i);
            long hits = Arrays.stream(s.toLowerCase(Locale.ROOT).split("[^a-z0-9]+")).filter(kws::contains).count();
            scored.add(new Scored(s, i, hits / Math.sqrt(s.split(" ").length) + (i == 0 ? 0.3 : 0)));
        }
        return scored.stream().sorted(Comparator.comparingDouble(Scored::v).reversed()).limit(n)
                .sorted(Comparator.comparingInt(Scored::i)).map(Scored::s).toList();
    }
}
