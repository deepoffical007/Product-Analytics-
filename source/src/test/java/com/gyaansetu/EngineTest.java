package com.gyaansetu;

import com.gyaansetu.dao.ResourceDao;
import com.gyaansetu.db.Database;
import com.gyaansetu.db.Seeder;
import com.gyaansetu.engine.Catalog;
import com.gyaansetu.engine.Ranker;
import com.gyaansetu.engine.Sentiment;
import com.gyaansetu.engine.Text;
import com.gyaansetu.web.Passwords;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Unit tests for text processing, sentiment, password hashing and the ranking engine (against the seeded catalogue). */
class EngineTest {
    private static Catalog catalog;
    private static Map<String, Ranker.Stats> stats;

    @BeforeAll
    static void setUp() throws Exception {
        System.setProperty("DB_URL", "jdbc:h2:mem:engine;DB_CLOSE_DELAY=-1;MODE=MySQL;DATABASE_TO_LOWER=TRUE");
        Database.init();
        Seeder.seedIfEmpty();
        try (Connection c = Database.get()) {
            catalog = new Catalog(ResourceDao.loadAll(c));
            stats = ResourceDao.stats(c);
        }
    }

    @AfterAll
    static void tearDown() {
        Database.shutdown();
        System.clearProperty("DB_URL");
    }

    private static List<String> top(String q, int n) {
        return Ranker.rank(catalog, q, new Ranker.Filters(), Ranker.DEFAULT_WEIGHTS, stats, null)
                .rows().stream().limit(n).map(x -> x.r.id).toList();
    }

    @Test
    void stemsAndTokenises() {
        assertEquals("tutorial", Text.stem("tutorials"));
        assertEquals("learn", Text.stem("learning"));
        assertEquals(List.of("python", "tutorial"), Text.tokenize("The Python tutorials!"));
        assertTrue(Text.lev1("calclus", "calculus"));
        assertFalse(Text.lev1("python", "pythonic"));
    }

    @Test
    void sentimentHandlesNegationAndIntensifiers() {
        assertTrue(Sentiment.score("Really clear and helpful") > 0.5);
        assertTrue(Sentiment.score("not useful at all") < -0.15);
        assertTrue(Sentiment.score("Clickbait. Shallow and misleading.") < -0.8);
        assertEquals("Neutral", Sentiment.label(Sentiment.score("The video is ten minutes long.")));
        assertEquals("Positive", Sentiment.label(Sentiment.score("Brilliant, I love it")));
    }

    @Test
    void passwordsHashAndVerify() {
        String h = Passwords.hash("demo1234");
        assertTrue(h.startsWith("pbkdf2$"));
        assertTrue(Passwords.verify("demo1234", h));
        assertFalse(Passwords.verify("demo1235", h));
        assertNotEquals(h, Passwords.hash("demo1234"), "salt makes every hash unique");
    }

    @Test
    void seedLoadsWholeCatalogue() {
        assertEquals(46, catalog.items.size());
        assertTrue(stats.get("la").reviewCount > 0);
    }

    @Test
    void clickbaitWithMostViewsDoesNotWin() {
        List<String> ids = top("machine learning", 3);
        assertFalse(ids.contains("ml10"), "popular but poorly rated video must not reach the top 3: " + ids);
        assertTrue(ids.contains("nn") || ids.contains("r2d3"));
    }

    @Test
    void typoToleranceAndSynonyms() {
        assertTrue(top("calclus", 3).stream().anyMatch(id -> List.of("eoc", "calc1", "khint").contains(id)));
        assertEquals("ww2", top("ww2", 1).get(0));
        Ranker.Query q = Ranker.parse("ml basics");
        assertTrue(q.expanded().contains("machine learning"));
    }

    @Test
    void filtersAndSortingWork() {
        Ranker.Filters f = new Ranker.Filters();
        f.types.add("pdf");
        f.minRating = 4.5;
        f.sort = "views";
        List<Ranker.Scored> rows = Ranker.rank(catalog, "", f, Ranker.DEFAULT_WEIGHTS, stats, null).rows();
        assertFalse(rows.isEmpty());
        for (Ranker.Scored x : rows) {
            assertEquals("pdf", x.r.type);
            assertTrue(x.s.avgRating() >= 4.5);
        }
        for (int i = 1; i < rows.size(); i++) assertTrue(rows.get(i - 1).s.views >= rows.get(i).s.views);
    }

    @Test
    void scoresStayInRangeAndPartsAddUp() {
        for (Ranker.Scored x : Ranker.rank(catalog, "python", new Ranker.Filters(), Ranker.DEFAULT_WEIGHTS, stats, null).rows()) {
            assertTrue(x.score >= 0 && x.score <= 1, x.r.id + " score " + x.score);
            double sum = x.parts.values().stream().mapToDouble(Double::doubleValue).sum();
            assertEquals(x.score, sum, 1e-9);
        }
    }

    @Test
    void personalProfileBoostsMatchingSubject() {
        Ranker.Profile p = new Ranker.Profile();
        p.add(catalog.byId.get("bio2e"), 3);
        Map<String, Integer> w = Map.of("rel", 0, "rating", 0, "feedback", 0, "eng", 0, "pop", 0, "personal", 100);
        Ranker.Scored first = Ranker.rank(catalog, "", new Ranker.Filters(), w, stats, p).rows().get(0);
        assertEquals("biology", first.r.subject);
    }
}
