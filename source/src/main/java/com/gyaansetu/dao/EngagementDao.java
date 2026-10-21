package com.gyaansetu.dao;

import com.gyaansetu.engine.Catalog;
import com.gyaansetu.engine.Ranker.Profile;
import com.gyaansetu.engine.Resource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Per-user engagement: likes, saves, completions, ratings and helpful votes. */
public final class EngagementDao {
    private static final Set<String> TOGGLE_TABLES = Set.of("likes", "saved", "completed");

    private EngagementDao() {}

    public static final class State {
        public boolean liked, saved, completed;
        public Integer rating;
        public Boolean helpful;
    }

    /** Flips a user/resource row in likes, saved or completed. Returns true when the row now exists. */
    public static boolean toggle(Connection c, String table, long userId, String resourceId) throws SQLException {
        if (!TOGGLE_TABLES.contains(table)) throw new IllegalArgumentException("Unknown table " + table);
        try (PreparedStatement del = c.prepareStatement("DELETE FROM " + table + " WHERE user_id = ? AND resource_id = ?")) {
            del.setLong(1, userId);
            del.setString(2, resourceId);
            if (del.executeUpdate() > 0) return false;
        }
        try (PreparedStatement ins = c.prepareStatement("INSERT INTO " + table + " (user_id, resource_id) VALUES (?, ?)")) {
            ins.setLong(1, userId);
            ins.setString(2, resourceId);
            ins.executeUpdate();
            return true;
        }
    }

    public static Integer rating(Connection c, long userId, String resourceId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT stars FROM ratings WHERE user_id = ? AND resource_id = ?")) {
            ps.setLong(1, userId);
            ps.setString(2, resourceId);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getInt(1) : null; }
        }
    }

    public static void setRating(Connection c, long userId, String resourceId, Integer stars) throws SQLException {
        try (PreparedStatement del = c.prepareStatement("DELETE FROM ratings WHERE user_id = ? AND resource_id = ?")) {
            del.setLong(1, userId);
            del.setString(2, resourceId);
            del.executeUpdate();
        }
        if (stars == null) return;
        try (PreparedStatement ins = c.prepareStatement("INSERT INTO ratings (user_id, resource_id, stars) VALUES (?, ?, ?)")) {
            ins.setLong(1, userId);
            ins.setString(2, resourceId);
            ins.setInt(3, stars);
            ins.executeUpdate();
        }
    }

    public static Boolean feedback(Connection c, long userId, String resourceId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT helpful FROM feedback WHERE user_id = ? AND resource_id = ?")) {
            ps.setLong(1, userId);
            ps.setString(2, resourceId);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getBoolean(1) : null; }
        }
    }

    public static void setFeedback(Connection c, long userId, String resourceId, Boolean helpful) throws SQLException {
        try (PreparedStatement del = c.prepareStatement("DELETE FROM feedback WHERE user_id = ? AND resource_id = ?")) {
            del.setLong(1, userId);
            del.setString(2, resourceId);
            del.executeUpdate();
        }
        if (helpful == null) return;
        try (PreparedStatement ins = c.prepareStatement("INSERT INTO feedback (user_id, resource_id, helpful) VALUES (?, ?, ?)")) {
            ins.setLong(1, userId);
            ins.setString(2, resourceId);
            ins.setBoolean(3, helpful);
            ins.executeUpdate();
        }
    }

    /** Everything one user has done, keyed by resource id. Empty for anonymous visitors. */
    public static Map<String, State> state(Connection c, Long userId) throws SQLException {
        Map<String, State> out = new HashMap<>();
        if (userId == null) return out;
        for (String table : List.of("likes", "saved", "completed")) {
            try (PreparedStatement ps = c.prepareStatement("SELECT resource_id FROM " + table + " WHERE user_id = ?")) {
                ps.setLong(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        State s = out.computeIfAbsent(rs.getString(1), k -> new State());
                        switch (table) {
                            case "likes" -> s.liked = true;
                            case "saved" -> s.saved = true;
                            default -> s.completed = true;
                        }
                    }
                }
            }
        }
        try (PreparedStatement ps = c.prepareStatement("SELECT resource_id, stars FROM ratings WHERE user_id = ?")) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.computeIfAbsent(rs.getString(1), k -> new State()).rating = rs.getInt(2);
            }
        }
        try (PreparedStatement ps = c.prepareStatement("SELECT resource_id, helpful FROM feedback WHERE user_id = ?")) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.computeIfAbsent(rs.getString(1), k -> new State()).helpful = rs.getBoolean(2);
            }
        }
        return out;
    }

    /** Builds a taste profile: likes, saves, completions and 4+ star ratings each add weight. */
    public static Profile profile(Map<String, State> state, Catalog catalog) {
        Profile p = new Profile();
        state.forEach((id, s) -> {
            Resource r = catalog.byId.get(id);
            if (r == null) return;
            double w = (s.liked ? 1 : 0) + (s.saved ? 1 : 0) + (s.completed ? 1 : 0) + (s.rating != null && s.rating >= 4 ? 1 : 0);
            p.add(r, w);
        });
        return p;
    }

    /** Saved resource ids, newest first. */
    public static List<String> savedIds(Connection c, long userId) throws SQLException {
        List<String> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("SELECT resource_id FROM saved WHERE user_id = ? ORDER BY created_at DESC")) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(rs.getString(1)); }
        }
        return out;
    }
}
