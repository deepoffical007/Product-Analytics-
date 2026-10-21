package com.gyaansetu.engine;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** In-memory catalogue of resources with its BM25 index, plus subject/type reference data. */
public final class Catalog {
    public static final Map<String, String[]> SUBJECTS = new LinkedHashMap<>();   // key -> {name, dewey}
    public static final Map<String, String[]> TYPES = new LinkedHashMap<>();      // key -> {label, code}
    public static final Set<String> LEVELS = Set.of("Beginner", "Intermediate", "Advanced");
    public static final Set<String> VERIFIED = new HashSet<>(Arrays.asList(
            "3Blue1Brown", "MIT OpenCourseWare", "freeCodeCamp", "OpenStax", "Khan Academy", "Wikipedia", "Caltech", "Harvard CS50",
            "MDN Web Docs", "Python Software Foundation", "Oracle", "Purdue OWL", "git-scm.com", "CrashCourse", "W3Schools", "R2D3",
            "Jake VanderPlas", "ptable.com", "bigocheatsheet.com", "db-book.com"));
    public static final List<String> TRENDING = List.of("python tutorial", "java oop", "dbms notes", "machine learning",
            "web development", "calculus", "photosynthesis", "supply and demand");
    public static final Map<String, List<String>> SYNONYMS = new LinkedHashMap<>();

    static {
        SUBJECTS.put("cs", new String[]{"Computer Science", "005"});
        SUBJECTS.put("math", new String[]{"Mathematics", "510"});
        SUBJECTS.put("physics", new String[]{"Physics", "530"});
        SUBJECTS.put("chemistry", new String[]{"Chemistry", "540"});
        SUBJECTS.put("biology", new String[]{"Biology", "570"});
        SUBJECTS.put("language", new String[]{"English", "428"});
        SUBJECTS.put("economics", new String[]{"Economics", "330"});
        SUBJECTS.put("history", new String[]{"History", "900"});
        TYPES.put("video", new String[]{"Video", "VID"});
        TYPES.put("pdf", new String[]{"PDF", "DOC"});
        TYPES.put("article", new String[]{"Article", "TXT"});
        TYPES.put("tutorial", new String[]{"Tutorial", "TUT"});
        TYPES.put("image", new String[]{"Image", "IMG"});
        String syn = "ml=machine learning|neural network;ai=machine learning|neural network|deep learning;"
                + "machine learning=neural network|deep learning|data science;deep learning=neural network|machine learning;"
                + "neural network=deep learning|machine learning;dna=genetics|genes;genetics=dna|inheritance;"
                + "calculus=derivatives|integrals;derivative=calculus;integral=calculus|integration;programming=python|coding;"
                + "coding=programming|python;code=programming;web=html|css|web development;website=html|css|web development;"
                + "database=sql|dbms;db=sql|database;dbms=database|sql;oop=classes|inheritance|java oop;object oriented=oop|classes|inheritance;"
                + "stats=statistics|probability;statistics=probability|data analysis;ww2=world war ii;wwii=world war ii;econ=economics;"
                + "management=economics;plants=photosynthesis;chem=chemistry;trig=trigonometry|unit circle;"
                + "algorithm=data structures|big-o|sorting;algorithms=data structures|big-o|sorting;matrix=linear algebra|matrices;"
                + "matrices=linear algebra;vectors=linear algebra;light=electromagnetic spectrum|optics;cell=cells|organelles;"
                + "evolution=genetics|biology;money=economics|banking|inflation;grammar=english|writing;writing=grammar|english;"
                + "quantum=quantum mechanics;elements=periodic table;git=version control;notes=pdf;"
                + "interview=algorithms|data structures|big-o;data science=python|pandas|statistics;science=physics|chemistry|biology";
        for (String e : syn.split(";")) {
            String[] kv = e.split("=");
            SYNONYMS.put(kv[0], List.of(kv[1].split("\\|")));
        }
    }

    private static volatile Catalog instance;

    public final List<Resource> items;
    public final Map<String, Resource> byId;
    final Map<String, Integer> df = new HashMap<>();
    final double avgdl;

    public Catalog(List<Resource> resources) {
        this.items = Collections.unmodifiableList(resources);
        Map<String, Resource> m = new LinkedHashMap<>();
        double total = 0;
        for (Resource r : resources) {
            m.put(r.id, r);
            index(r, r.title, 3);
            index(r, String.join(" ", r.tags), 2);
            index(r, subjectName(r.subject), 1.5);
            index(r, r.source, 1);
            index(r, r.desc, 1);
            index(r, typeLabel(r.type), 1);
            r.tf.keySet().forEach(t -> df.merge(t, 1, Integer::sum));
            total += r.dl;
        }
        this.byId = Collections.unmodifiableMap(m);
        this.avgdl = resources.isEmpty() ? 1 : total / resources.size();
    }

    private static void index(Resource r, String text, double weight) {
        for (String t : Text.tokenize(text)) {
            r.tf.merge(t, weight, Double::sum);
            r.dl += weight;
        }
    }

    public static Catalog get() {
        if (instance == null) throw new IllegalStateException("Catalog not loaded");
        return instance;
    }

    public static void set(Catalog c) { instance = c; }

    public static String subjectName(String key) { String[] s = SUBJECTS.get(key); return s == null ? key : s[0]; }

    public static String dewey(String key) { String[] s = SUBJECTS.get(key); return s == null ? "000" : s[1]; }

    public static String typeLabel(String key) { String[] t = TYPES.get(key); return t == null ? key : t[0]; }

    public static String typeCode(String key) { String[] t = TYPES.get(key); return t == null ? "???" : t[1]; }
}
