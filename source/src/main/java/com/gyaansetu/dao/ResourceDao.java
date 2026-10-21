package com.gyaansetu.dao;

import com.gyaansetu.engine.Ranker.Stats;
import com.gyaansetu.engine.Resource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** JDBC access to the resources table and its aggregate engagement counters. */
public final class ResourceDao {
    private ResourceDao() {}

    public static List<Resource> loadAll(Connection c) throws SQLException {
        List<Resource> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, title, content_type, subject, difficulty, source, url, length_label, published, description, tags, sort_order "
                        + "FROM resources ORDER BY sort_order");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                out.add(new Resource(rs.getString("id"), rs.getString("title"), rs.getString("content_type"), rs.getString("subject"),
                        rs.getString("difficulty"), rs.getString("source"), rs.getString("url"), rs.getString("length_label"),
                        rs.getDate("published") == null ? null : rs.getDate("published").toString(), rs.getString("description"),
                        Arrays.asList(rs.getString("tags").split("\\|")), rs.getInt("sort_order")));
            }
        }
        return out;
    }

    /** Engagement counters joined with review sentiment aggregates, keyed by resource id. */
    public static Map<String, Stats> stats(Connection c) throws SQLException {
        Map<String, Stats> out = new HashMap<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, views, likes, rating_sum, rating_count, helpful_yes, helpful_no FROM resources");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Stats s = new Stats();
                s.views = rs.getLong("views");
                s.likes = rs.getLong("likes");
                s.ratingSum = rs.getDouble("rating_sum");
                s.ratingCount = rs.getInt("rating_count");
                s.helpfulYes = rs.getInt("helpful_yes");
                s.helpfulNo = rs.getInt("helpful_no");
                out.put(rs.getString("id"), s);
            }
        }
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT resource_id, COUNT(*) AS n, SUM(sentiment) AS ssum, "
                        + "SUM(CASE WHEN sentiment > 0.15 THEN 1 ELSE 0 END) AS pos FROM reviews GROUP BY resource_id");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Stats s = out.get(rs.getString("resource_id"));
                if (s == null) continue;
                s.reviewCount = rs.getInt("n");
                s.sentimentSum = rs.getDouble("ssum");
                s.positiveCount = rs.getInt("pos");
            }
        }
        return out;
    }

    public static boolean exists(Connection c, String id) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT 1 FROM resources WHERE id = ?")) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }

    public static int count(Connection c) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM resources"); ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getInt(1);
        }
    }

    public static void addViews(Connection c, String id, long delta) throws SQLException {
        update(c, "UPDATE resources SET views = views + ? WHERE id = ?", delta, id);
    }

    public static void addLikes(Connection c, String id, long delta) throws SQLException {
        update(c, "UPDATE resources SET likes = GREATEST(likes + ?, 0) WHERE id = ?", delta, id);
    }

    public static void adjustRating(Connection c, String id, double sumDelta, int countDelta) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "UPDATE resources SET rating_sum = rating_sum + ?, rating_count = rating_count + ? WHERE id = ?")) {
            ps.setDouble(1, sumDelta);
            ps.setInt(2, countDelta);
            ps.setString(3, id);
            ps.executeUpdate();
        }
    }

    public static void adjustHelpful(Connection c, String id, int yesDelta, int noDelta) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "UPDATE resources SET helpful_yes = helpful_yes + ?, helpful_no = helpful_no + ? WHERE id = ?")) {
            ps.setInt(1, yesDelta);
            ps.setInt(2, noDelta);
            ps.setString(3, id);
            ps.executeUpdate();
        }
    }

    private static void update(Connection c, String sql, long delta, String id) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, delta);
            ps.setString(2, id);
            ps.executeUpdate();
        }
    }
}
