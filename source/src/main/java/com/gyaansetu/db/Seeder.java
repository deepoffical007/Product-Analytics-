package com.gyaansetu.db;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.gyaansetu.dao.ForumDao;
import com.gyaansetu.dao.PlannerDao;
import com.gyaansetu.dao.ResourceDao;
import com.gyaansetu.dao.ReviewDao;
import com.gyaansetu.dao.UserDao;
import com.gyaansetu.engine.Sentiment;
import com.gyaansetu.web.Passwords;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

/** Fills an empty database with the sample catalogue, reviews, community threads and a demo account. */
public final class Seeder {
    private static final Logger LOG = Logger.getLogger(Seeder.class.getName());
    private static final String[] NAMES = {"Aarav", "Mei", "Rohit", "Fatima", "Diego", "Priya", "Noah", "Zara", "Kenji", "Amara", "Ishaan", "Sofia", "Omar", "Ananya"};
    public static final String DEMO_EMAIL = "demo@gyaansetu.in";
    public static final String DEMO_PASSWORD = "demo1234";

    private Seeder() {}

    public static void seedIfEmpty() {
        try (Connection c = Database.get()) {
            if (ResourceDao.count(c) > 0) return;
            c.setAutoCommit(false);
            try {
                seed(c);
                c.commit();
                LOG.info("Seeded sample data into " + Database.url());
            } catch (SQLException | RuntimeException e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Seeding failed: " + e.getMessage(), e);
        }
    }

    private static Timestamp daysAgo(double days) {
        return new Timestamp(System.currentTimeMillis() - (long) (days * 86_400_000L));
    }

    private static void seed(Connection c) throws SQLException {
        JsonArray items;
        try (InputStream in = Seeder.class.getResourceAsStream("/seed/resources.json")) {
            if (in == null) throw new IllegalStateException("Missing /seed/resources.json");
            items = JsonParser.parseReader(new InputStreamReader(in, StandardCharsets.UTF_8)).getAsJsonArray();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }

        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO resources (id, title, content_type, subject, difficulty, source, url, length_label, published, description, tags, "
                        + "views, likes, rating_sum, rating_count, helpful_yes, helpful_no, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
            int order = 0;
            for (JsonElement el : items) {
                JsonObject o = el.getAsJsonObject();
                List<String> tags = new ArrayList<>();
                o.getAsJsonArray("tags").forEach(t -> tags.add(t.getAsString()));
                ps.setString(1, o.get("id").getAsString());
                ps.setString(2, o.get("title").getAsString());
                ps.setString(3, o.get("type").getAsString());
                ps.setString(4, o.get("subject").getAsString());
                ps.setString(5, o.get("level").getAsString());
                ps.setString(6, o.get("source").getAsString());
                ps.setString(7, o.get("url").isJsonNull() ? null : o.get("url").getAsString());
                ps.setString(8, o.get("len").getAsString());
                ps.setDate(9, Date.valueOf(o.get("date").getAsString()));
                ps.setString(10, o.get("desc").getAsString());
                ps.setString(11, String.join("|", tags));
                ps.setLong(12, o.get("views").getAsLong());
                ps.setLong(13, o.get("likes").getAsLong());
                ps.setDouble(14, o.get("rating").getAsDouble() * o.get("ratings").getAsInt());
                ps.setInt(15, o.get("ratings").getAsInt());
                ps.setInt(16, o.get("hy").getAsInt());
                ps.setInt(17, o.get("hn").getAsInt());
                ps.setInt(18, order++);
                ps.addBatch();
            }
            ps.executeBatch();
        }

        int i = 0;
        for (JsonElement el : items) {
            JsonObject o = el.getAsJsonObject();
            double rating = o.get("rating").getAsDouble();
            int j = 0;
            for (JsonElement cm : o.getAsJsonArray("comments")) {
                String body = cm.getAsString();
                double s = Sentiment.score(body);
                int stars = (int) Math.max(1, Math.min(5, Math.round(rating + s * 0.8)));
                ReviewDao.add(c, o.get("id").getAsString(), null, NAMES[(i * 3 + j) % NAMES.length], body, stars, s,
                        3 + ((i * 7 + j * 5) % 40), daysAgo(2 + ((i * 3 + j * 11) % 60)));
                j++;
            }
            i++;
        }

        // Community members for the leaderboard (no password, cannot sign in)
        long ananya = UserDao.create(c, "Ananya", null, null, false, 412);
        long rohit = UserDao.create(c, "Rohit", null, null, false, 365);
        long mei = UserDao.create(c, "Mei", null, null, false, 298);
        long ishaan = UserDao.create(c, "Ishaan", null, null, false, 240);
        long priya = UserDao.create(c, "Priya", null, null, false, 188);
        UserDao.create(c, "Diego", null, null, false, 126);
        long zara = UserDao.create(c, "Zara", null, null, false, 94);

        // Demo account so the dashboard has data during a presentation
        long demo = UserDao.create(c, "Yashika", DEMO_EMAIL, Passwords.hash(DEMO_PASSWORD), false, 150);
        PlannerDao.addSearchAt(c, demo, "machine learning", daysAgo(1));
        PlannerDao.addSearchAt(c, demo, "dbms notes", daysAgo(0.2));
        PlannerDao.addSearchAt(c, demo, "python tutorial", daysAgo(0.08));
        PlannerDao.addGoal(c, demo, "Finish Python basics: loops and functions", "Mon", true);
        PlannerDao.addGoal(c, demo, "Watch Essence of Calculus, chapters 1-3", "Wed", false);
        PlannerDao.addGoal(c, demo, "Practise 10 SQL JOIN questions", "Fri", false);
        try (PreparedStatement ps = c.prepareStatement("INSERT INTO saved (user_id, resource_id, created_at) VALUES (?, ?, ?)")) {
            String[] ids = {"py", "dbms", "cs50"};
            for (int k = 0; k < ids.length; k++) {
                ps.setLong(1, demo);
                ps.setString(2, ids[k]);
                ps.setTimestamp(3, daysAgo(3 - k));
                ps.addBatch();
            }
            ps.executeBatch();
        }
        try (PreparedStatement ps = c.prepareStatement("INSERT INTO completed (user_id, resource_id, created_at) VALUES (?, ?, ?)")) {
            ps.setLong(1, demo);
            ps.setString(2, "w3py");
            ps.setTimestamp(3, daysAgo(2));
            ps.executeUpdate();
        }

        long t1 = ForumDao.create(c, ananya, "Ananya", "What is the difference between a list and a tuple in Python?",
                "I keep mixing them up. When should I use each one?", "cs", 14, daysAgo(0.12));
        ForumDao.addAnswer(c, t1, rohit, "Rohit", "Lists are mutable, so you can add or change items. Tuples are immutable, "
                + "which makes them good for fixed records and as dictionary keys.", false, daysAgo(0.08));
        long t2 = ForumDao.create(c, ishaan, "Ishaan", "Best way to revise DBMS normalisation before exams?",
                "1NF, 2NF, 3NF and BCNF all blur together for me. Any resources or tricks?", "cs", 9, daysAgo(1));
        ForumDao.addAnswer(c, t2, priya, "Priya", "Work through one messy table and normalise it step by step. "
                + "The db-book slides on GyaanSetu have a good worked example.", false, daysAgo(0.8));
        ForumDao.create(c, mei, "Mei", "Why does the chain rule work?",
                "I can apply it but I do not get the intuition behind multiplying derivatives.", "math", 21, daysAgo(2));
        ForumDao.create(c, zara, "Zara", "How do C4 plants avoid photorespiration?",
                "Our textbook mentions bundle sheath cells but I am confused about the steps.", "biology", 6, daysAgo(4));
    }
}
