package com.gyaansetu.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/** JDBC access to study goals and search history. */
public final class PlannerDao {
    private PlannerDao() {}

    public record Goal(long id, String text, String day, boolean done) {}

    public record Search(String query, Timestamp at) {}

    public static List<Goal> goals(Connection c, long userId) throws SQLException {
        List<Goal> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, goal_text, plan_day, done FROM goals WHERE user_id = ? "
                        + "ORDER BY CASE plan_day WHEN 'Mon' THEN 1 WHEN 'Tue' THEN 2 WHEN 'Wed' THEN 3 WHEN 'Thu' THEN 4 "
                        + "WHEN 'Fri' THEN 5 WHEN 'Sat' THEN 6 ELSE 7 END, id")) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(new Goal(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getBoolean(4)));
            }
        }
        return out;
    }

    public static long addGoal(Connection c, long userId, String text, String day, boolean done) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO goals (user_id, goal_text, plan_day, done) VALUES (?, ?, ?, ?)", Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, userId);
            ps.setString(2, text);
            ps.setString(3, day);
            ps.setBoolean(4, done);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) { keys.next(); return keys.getLong(1); }
        }
    }

    /** Returns true when the goal belonged to the user and was updated. */
    public static boolean setDone(Connection c, long userId, long goalId, boolean done) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("UPDATE goals SET done = ? WHERE id = ? AND user_id = ?")) {
            ps.setBoolean(1, done);
            ps.setLong(2, goalId);
            ps.setLong(3, userId);
            return ps.executeUpdate() > 0;
        }
    }

    public static boolean deleteGoal(Connection c, long userId, long goalId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("DELETE FROM goals WHERE id = ? AND user_id = ?")) {
            ps.setLong(1, goalId);
            ps.setLong(2, userId);
            return ps.executeUpdate() > 0;
        }
    }

    public static void deleteOpenGoals(Connection c, long userId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("DELETE FROM goals WHERE user_id = ? AND done = FALSE")) {
            ps.setLong(1, userId);
            ps.executeUpdate();
        }
    }

    /** Records a search, replacing an older identical one so the history stays unique. */
    public static void addSearch(Connection c, long userId, String query) throws SQLException {
        try (PreparedStatement del = c.prepareStatement("DELETE FROM searches WHERE user_id = ? AND LOWER(query_text) = LOWER(?)")) {
            del.setLong(1, userId);
            del.setString(2, query);
            del.executeUpdate();
        }
        try (PreparedStatement ins = c.prepareStatement("INSERT INTO searches (user_id, query_text, created_at) VALUES (?, ?, ?)")) {
            ins.setLong(1, userId);
            ins.setString(2, query);
            ins.setTimestamp(3, new Timestamp(System.currentTimeMillis()));
            ins.executeUpdate();
        }
    }

    public static void addSearchAt(Connection c, long userId, String query, Timestamp at) throws SQLException {
        try (PreparedStatement ins = c.prepareStatement("INSERT INTO searches (user_id, query_text, created_at) VALUES (?, ?, ?)")) {
            ins.setLong(1, userId);
            ins.setString(2, query);
            ins.setTimestamp(3, at);
            ins.executeUpdate();
        }
    }

    public static List<Search> searches(Connection c, long userId, int limit) throws SQLException {
        List<Search> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT query_text, created_at FROM searches WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")) {
            ps.setLong(1, userId);
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(new Search(rs.getString(1), rs.getTimestamp(2))); }
        }
        return out;
    }

    public static void clearSearches(Connection c, long userId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("DELETE FROM searches WHERE user_id = ?")) {
            ps.setLong(1, userId);
            ps.executeUpdate();
        }
    }
}
